import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import {
  db,
  findEvent,
  findMembers,
  preferenceVector,
  toApiEvent,
  type EventRow,
} from "../../db/queries.js";
import { centroid, matchScore } from "../matching/score.js";
import { matchReasons } from "../matching/reasons.js";
import type { Language } from "../../types.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { uuidParam } from "../../utils/request.js";
import { parseVector } from "../../utils/vector.js";
import { chatRouter } from "../chat/routes.js";
import { feedbackRouter } from "../feedback/routes.js";
import { recapRouter } from "../recap/routes.js";

const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const createSchema = z.object({
  title: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  description: z.string().max(500).optional(),
  venue_name: z.string().min(1).max(80),
  location: coordsSchema,
  /**
   * Future only. A past `start_time` produced a meetup that `event_status()` already
   * reported as `completed` — joinable by nobody, and immediately eligible for the
   * sweep's ghost penalty against a group that never met.
   */
  start_time: z
    .string()
    .datetime()
    .refine((value) => Date.parse(value) > Date.now(), {
      message: "start_time must be in the future.",
    }),
  max_size: z.number().int().min(4).max(6),
});

/** Discovery is city-scale; a wider radius would scan the whole table. */
const MAX_RADIUS_M = 50_000;

export const eventsRouter = Router();

eventsRouter.get(
  "/nearby",
  requireAuth,
  asyncRoute(async (req, res) => {
    const coords = coordsSchema.safeParse({
      lat: Number(req.query.lat),
      lng: Number(req.query.lng),
    });

    if (!coords.success) {
      throw new HttpError(400, "INVALID_QUERY", "Valid lat and lng are required.");
    }

    const radius = Number(req.query.radius);

    const { data, error } = await db().rpc("events_nearby", {
      p_lat: coords.data.lat,
      p_lng: coords.data.lng,
      p_radius: Number.isFinite(radius)
        ? Math.min(MAX_RADIUS_M, Math.max(1, radius))
        : 5000,
      p_category: req.query.category ? String(req.query.category) : null,
    });

    if (error) throw dbError(error);

    return ok(res, { events: ((data ?? []) as EventRow[]).map(toApiEvent) });
  })
);

eventsRouter.get(
  "/mine",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const { data, error } = await db().rpc("events_for_user", {
      p_user_id: req.userId!,
    });

    if (error) throw dbError(error);

    return ok(res, { events: ((data ?? []) as EventRow[]).map(toApiEvent) });
  })
);

eventsRouter.post(
  "/",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const parsed = createSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", parsed.error.issues[0]!.message);
    }

    const body = parsed.data;

    // One statement, one transaction: the event row and the host's group_members row are
    // written together by create_event, because a failure between two separate inserts
    // left a group with no members at all. Same reason join_event is an RPC.
    const { data, error } = await db().rpc("create_event", {
      p_host_id: req.userId!,
      p_title: body.title,
      p_category: body.category,
      p_description: body.description ?? "",
      p_venue_name: body.venue_name,
      p_lat: body.location.lat,
      p_lng: body.location.lng,
      p_start_time: body.start_time,
      p_max_size: body.max_size,
    });

    if (error) throw dbError(error);

    if (typeof data !== "string" || data.length === 0) {
      throw dbError({ message: "create_event returned no event id." });
    }

    return ok(res, { event: toApiEvent(await findEvent(data)) }, 201);
  })
);

eventsRouter.get(
  "/:id",
  requireAuth,
  asyncRoute(async (req, res) => {
    const event = await findEvent(uuidParam(req, "id"));

    return ok(res, {
      event: toApiEvent(event),
      members: await findMembers(uuidParam(req, "id")),
    });
  })
);

/** Postgres raises these names from join_event; map them to the API's codes. */
const JOIN_ERRORS: Record<string, [number, string, string]> = {
  EVENT_NOT_FOUND: [404, "NOT_FOUND", "Event not found."],
  EVENT_CLOSED: [409, "EVENT_CLOSED", "This meetup is no longer open."],
  EVENT_FULL: [409, "EVENT_FULL", "This group is already full."],
};

eventsRouter.post(
  "/:id/join",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const eventId = uuidParam(req, "id");

    // Seat counting and the status flip happen inside one locked transaction so two
    // people racing for the last seat cannot both win it.
    const { data, error } = await db()
      .rpc("join_event", { p_event_id: eventId, p_user_id: req.userId! })
      .maybeSingle<{ status: "joined" | "matched"; current_size: number }>();

    if (error) {
      for (const [name, [status, code, message]] of Object.entries(JOIN_ERRORS)) {
        if (error.message.includes(name)) throw new HttpError(status, code, message);
      }
      throw dbError(error);
    }

    if (!data) throw new HttpError(404, "NOT_FOUND", "Event not found.");

    // "matched" means the group is now at max_size (docs/API_STRUCTURE.md §3.5).
    return ok(res, { status: data.status, group_id: eventId });
  })
);

eventsRouter.post(
  "/:id/leave",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const event = await findEvent(uuidParam(req, "id"));

    if (event.host_id === req.userId) {
      throw new HttpError(403, "HOST_CANNOT_LEAVE", "The host cannot leave their own meetup.");
    }

    // Leaving is for a group that has not met yet. Without this a member could walk out
    // of an ongoing or finished meetup and drop their group_members row before the
    // sweep's settle() pass reads it, escaping the ghost penalty for skipping feedback.
    if (event.status === "ongoing" || event.status === "completed") {
      throw new HttpError(
        409,
        "MEETUP_ALREADY_STARTED",
        "You cannot leave a meetup that has already started."
      );
    }

    const { error } = await db()
      .from("group_members")
      .delete()
      .eq("event_id", event.id)
      .eq("user_id", req.userId!);

    if (error) throw dbError(error);

    // Reopen a group that was closed only because it was full; the extra `status`
    // filter keeps this from overwriting an ongoing/completed meetup.
    if (event.status === "full") {
      const { error: statusError } = await db()
        .from("events")
        .update({ status: "open" })
        .eq("id", event.id)
        .eq("status", "full");

      if (statusError) throw dbError(statusError);
    }

    return ok(res, { success: true });
  })
);

eventsRouter.get(
  "/:id/members",
  requireAuth,
  asyncRoute(async (req, res) =>
    ok(res, { members: await findMembers(uuidParam(req, "id")) })
  )
);

/** Group vector = centroid of the members' preference vectors (docs/AI.md §5). */
async function groupVector(eventId: string): Promise<number[]> {
  const { data, error } = await db()
    .from("group_members")
    .select("user:users (preference_vector)")
    .eq("event_id", eventId);

  if (error) throw dbError(error);

  const vectors = ((data ?? []) as unknown as {
    user: { preference_vector: unknown } | null;
  }[])
    .map((row) => parseVector(row.user?.preference_vector))
    .filter((vector): vector is number[] => vector !== null);

  return centroid(vectors);
}

eventsRouter.get(
  "/:id/match-preview",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const event = await findEvent(uuidParam(req, "id"));
    const members = await findMembers(event.id);

    const [userVector, groupCentroid] = await Promise.all([
      preferenceVector(req.userId!),
      groupVector(event.id),
    ]);

    const me = members.find((member) => member.user_id === req.userId);

    const { data: profile, error } = await db()
      .from("users")
      .select("interests, reputation_score, language")
      .eq("id", req.userId!)
      .maybeSingle<{
        interests: string[];
        reputation_score: number;
        language: Language;
      }>();

    if (error) throw dbError(error);

    const score = matchScore({
      userVector: userVector ?? [],
      groupVector: groupCentroid,
      currentSize: Number(event.current_size),
      maxSize: event.max_size,
      reputation: profile?.reputation_score ?? 50,
    });

    const sharedInterests = (profile?.interests ?? []).filter((interest) =>
      members.some(
        (member) =>
          member.user_id !== req.userId && member.user.interests.includes(interest)
      )
    );

    return ok(res, {
      match_score: Math.round(score * 100) / 100,
      why: matchReasons(profile?.language ?? "en", {
        sharedInterests,
        currentSize: Number(event.current_size),
        maxSize: event.max_size,
        isMember: Boolean(me),
        hasPreferenceVector: userVector !== null,
      }),
    });
  })
);

// Per-event sub-resources live in their own modules.
eventsRouter.use("/", chatRouter);
eventsRouter.use("/", feedbackRouter);
eventsRouter.use("/", recapRouter);
