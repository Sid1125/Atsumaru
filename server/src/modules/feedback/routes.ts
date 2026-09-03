import { Router } from "express";
import { z } from "zod";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import {
  CONNECTION_COLUMNS,
  db,
  findEvent,
  findMembers,
  preferenceVector,
  requireMembership,
  type ConnectionRow,
} from "../../db/queries.js";
import {
  applyReputation,
  GOOD_RATING_LR_FACTOR,
  ratingDelta,
  REPUTATION_DELTA,
  updatePreferenceVector,
  type Rating,
} from "../matching/score.js";
import { emitToUser } from "../../socket/index.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { uuidParam } from "../../utils/request.js";
import { parseVector, serializeVector } from "../../utils/vector.js";

const submitSchema = z.object({
  ratings: z
    .array(
      z.object({
        to_user: z.string().uuid(),
        rating: z.enum(["meh", "good", "fire"]),
      })
    )
    .min(1)
    .max(5),
  rejoin: z.boolean(),
  connect_with: z.array(z.string().uuid()).max(5).optional(),
});

export const feedbackRouter = Router();

// Ratings and connection picks stay private: only mutual pairs may be revealed,
// and the response must never say who did not pick the caller (docs/RULES.md §8-9).
feedbackRouter.get(
  "/:id/feedback-form",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    await requireMembership(uuidParam(req, "id"), req.userId!);

    const members = await findMembers(uuidParam(req, "id"));

    return ok(res, {
      members: members.filter((member) => member.user_id !== req.userId),
    });
  })
);

/** Reputation is read-modify-write; the row count is at most the group size. */
async function bumpReputation(deltas: Map<string, number>) {
  const ids = [...deltas.keys()];

  if (ids.length === 0) return;

  const { data, error } = await db()
    .from("users")
    .select("id, reputation_score")
    .in("id", ids);

  if (error) throw dbError(error);

  for (const row of (data ?? []) as { id: string; reputation_score: number }[]) {
    const next = applyReputation(Number(row.reputation_score), deltas.get(row.id) ?? 0);

    const { error: updateError } = await db()
      .from("users")
      .update({ reputation_score: next })
      .eq("id", row.id);

    if (updateError) throw dbError(updateError);
  }
}

async function vectorsFor(userIds: string[]): Promise<Map<string, number[]>> {
  const result = new Map<string, number[]>();

  if (userIds.length === 0) return result;

  const { data, error } = await db()
    .from("users")
    .select("id, preference_vector")
    .in("id", userIds);

  if (error) throw dbError(error);

  for (const row of (data ?? []) as { id: string; preference_vector: unknown }[]) {
    const vector = parseVector(row.preference_vector);
    if (vector) result.set(row.id, vector);
  }

  return result;
}

feedbackRouter.post(
  "/:id/feedback",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    const eventId = uuidParam(req, "id");
    const userId = req.userId!;

    await requireMembership(eventId, userId);

    // Feedback is post-meetup by definition (docs/PRD.md FR-09). Without this a member
    // could rate the group the moment it forms, farm the participation credit, and
    // unlock a mutual 1:1 before anyone had met. findEvent returns the derived status,
    // so this closes the same instant event_status() flips to completed.
    const event = await findEvent(eventId);

    if (event.status !== "completed") {
      throw new HttpError(
        409,
        "MEETUP_NOT_FINISHED",
        "Feedback opens once the meetup has finished."
      );
    }

    const parsed = submitSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(400, "INVALID_BODY", parsed.error.issues[0]!.message);
    }

    const { ratings, rejoin } = parsed.data;
    const picks = new Set(parsed.data.connect_with ?? []);

    const members = await findMembers(eventId);
    const others = new Set(
      members.filter((member) => member.user_id !== userId).map((m) => m.user_id)
    );

    for (const entry of ratings) {
      if (!others.has(entry.to_user)) {
        throw new HttpError(400, "INVALID_BODY", "You can only rate group members.");
      }
    }

    // A pick without a rating has no signal to learn from, so require both.
    for (const pick of picks) {
      if (!ratings.some((entry) => entry.to_user === pick)) {
        throw new HttpError(400, "INVALID_BODY", "Rate everyone you want to connect with.");
      }
    }

    // Reputation and preference learning must happen once per meetup: without this
    // check a caller could resubmit to farm their own score or tank someone else's.
    const { count, error: priorError } = await db()
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("from_user", userId);

    if (priorError) throw dbError(priorError);

    const firstSubmission = (count ?? 0) === 0;

    const { error } = await db()
      .from("feedback")
      .upsert(
        ratings.map((entry) => ({
          event_id: eventId,
          from_user: userId,
          to_user: entry.to_user,
          rating: entry.rating,
          wants_connection: picks.has(entry.to_user),
          rejoin,
        })),
        { onConflict: "event_id,from_user,to_user" }
      );

    if (error) throw dbError(error);

    // Reputation: credit for participating, plus what the caller's ratings imply.
    if (firstSubmission) {
      const deltas = new Map<string, number>([
        [userId, REPUTATION_DELTA.submittedFeedback],
      ]);

      for (const entry of ratings) {
        deltas.set(
          entry.to_user,
          (deltas.get(entry.to_user) ?? 0) + ratingDelta(entry.rating)
        );
      }

      await bumpReputation(deltas);
    }

    // Preference learning (docs/AI.md §6): fire pulls, meh pushes, good pulls at half rate.
    const current = firstSubmission ? await preferenceVector(userId) : null;

    if (current) {
      const vectors = await vectorsFor(ratings.map((entry) => entry.to_user));
      const pick = (rating: Rating) =>
        ratings
          .filter((entry) => entry.rating === rating)
          .map((entry) => vectors.get(entry.to_user))
          .filter((vector): vector is number[] => vector !== undefined);

      let next = updatePreferenceVector(current, pick("fire"), pick("meh"));
      next = updatePreferenceVector(next, pick("good"), [], 0.1 * GOOD_RATING_LR_FACTOR);

      const { error: vectorError } = await db()
        .from("users")
        .update({ preference_vector: serializeVector(next) })
        .eq("id", userId);

      if (vectorError) throw dbError(vectorError);
    }

    // Unlock only where the other side also asked for it. Non-mutual picks stay secret.
    const unlocked: ConnectionRow[] = [];

    if (picks.size > 0) {
      const { data: theirPicks, error: picksError } = await db()
        .from("feedback")
        .select("from_user")
        .eq("event_id", eventId)
        .eq("to_user", userId)
        .eq("wants_connection", true)
        .in("from_user", [...picks]);

      if (picksError) throw dbError(picksError);

      for (const row of (theirPicks ?? []) as { from_user: string }[]) {
        // The table's check constraint requires user_a < user_b.
        const [user_a, user_b] = [userId, row.from_user].sort();

        // Only the first unlock of a pair is an event. Re-upserting would reset
        // unlocked_at and re-notify the other side on every resubmission, so read
        // first and treat an existing row as already-delivered.
        const { data: already, error: existingError } = await db()
          .from("connections")
          .select(CONNECTION_COLUMNS)
          .eq("event_id", eventId)
          .eq("user_a", user_a!)
          .eq("user_b", user_b!)
          .maybeSingle<ConnectionRow>();

        if (existingError) throw dbError(existingError);

        if (already) {
          unlocked.push(already);
          continue;
        }

        const { data: connection, error: connectionError } = await db()
          .from("connections")
          .upsert(
            {
              event_id: eventId,
              user_a: user_a!,
              user_b: user_b!,
              mutual: true,
              unlocked_at: new Date().toISOString(),
            },
            { onConflict: "event_id,user_a,user_b" }
          )
          .select(CONNECTION_COLUMNS)
          .single<ConnectionRow>();

        if (connectionError) {
          throw dbError(connectionError);
        }

        unlocked.push(connection);

        // Contract payload is the Connection itself (docs/API_STRUCTURE.md §4).
        emitToUser(row.from_user, "match:unlocked", connection);
      }
    }

    return ok(res, { success: true, connections_unlocked: unlocked });
  })
);
