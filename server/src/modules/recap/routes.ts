/**
 * Vibe recap route (docs/AI.md §6a, docs/IDEA.md §10).
 *
 * `GET /events/:id/recap` — one short AI-written line about what the caller's own
 * post-meetup ratings imply, cached in `meetup_recaps` because it costs a Groq call and
 * the ratings behind it are already final.
 *
 * Four gates, in this order, and the order matters: membership before existence details,
 * completion before content, and the caller's own feedback before anything is generated.
 * The last one is the privacy gate — a member who rated nobody has no ratings to
 * summarise, so there is no recap to give them, and generating one from the *group's*
 * feedback would leak other people's picks (docs/RULES.md §8).
 */

import { Router } from "express";

import { requireAuth, type AuthedRequest } from "../../middleware/auth.js";
import { asyncRoute } from "../../middleware/errorHandler.js";
import {
  db,
  findEvent,
  publicUser,
  requireMembership,
  type PublicUser,
} from "../../db/queries.js";
import { vibeRecap } from "../../services/ai.js";
import { dbError, HttpError, ok } from "../../utils/response.js";
import { uuidParam } from "../../utils/request.js";
import { createRateLimiter } from "../../utils/rateLimit.js";
import { enforceReadLimit } from "../../utils/readLimit.js";
import { tryQuota } from "../../utils/quota.js";
import type { Rating } from "../matching/score.js";
import {
  recapPrompt,
  templateRecap,
  traitsFromRatings,
  type RatedMember,
} from "./vibe.js";

export const recapRouter = Router();

/**
 * Generation is capped even though the result is cached: a member of many finished
 * meetups could otherwise walk them all in one burst. Reads from cache do not count
 * against this — only calls that would reach Groq.
 */
const recapLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 60 * 1000 });

interface OwnFeedbackRow {
  to_user: string;
  rating: Rating;
}

/** The caller's own ratings only — never the rest of the group's. */
async function ownRatings(
  eventId: string,
  userId: string
): Promise<OwnFeedbackRow[]> {
  const { data, error } = await db()
    .from("feedback")
    .select("to_user, rating")
    .eq("event_id", eventId)
    .eq("from_user", userId);

  if (error) throw dbError(error);

  return (data ?? []) as OwnFeedbackRow[];
}

/**
 * Public traits of the people the caller rated, keyed by id.
 *
 * `PUBLIC_USER_COLUMNS` via `publicUser` would be one round trip per member; this reads
 * the same two public array columns in one query. `real_name` is not among them, and the
 * ids are dropped before anything is sent to the model.
 */
async function traitsByUser(userIds: string[]): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();

  if (userIds.length === 0) return result;

  const { data, error } = await db()
    .from("users")
    .select("id, interests, personality")
    .in("id", userIds);

  if (error) throw dbError(error);

  for (const row of (data ?? []) as {
    id: string;
    interests: string[];
    personality: string[];
  }[]) {
    result.set(row.id, [...(row.interests ?? []), ...(row.personality ?? [])]);
  }

  return result;
}

interface RecapRow {
  recap: string;
  traits: string[];
  source: "ai" | "template";
  created_at: string;
}

recapRouter.get(
  "/:id/recap",
  requireAuth,
  asyncRoute(async (req: AuthedRequest, res) => {
    enforceReadLimit(req, res);
    const eventId = uuidParam(req, "id");
    const userId = req.userId!;

    await requireMembership(eventId, userId);

    // A recap of a meetup that has not happened would be a recap of nothing. Same
    // derived status the feedback gate uses, so the two open together.
    const event = await findEvent(eventId);

    if (event.status !== "completed") {
      throw new HttpError(
        409,
        "MEETUP_NOT_FINISHED",
        "The recap arrives once the meetup has finished."
      );
    }

    // Cache first: the recap never changes, so a second read must not re-bill Groq or
    // hand the member a differently-worded version of the same meetup.
    const { data: cached, error: cacheError } = await db()
      .from("meetup_recaps")
      .select("recap, traits, source, created_at")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle<RecapRow>();

    if (cacheError) throw dbError(cacheError);

    if (cached) {
      return ok(res, {
        recap: cached.recap,
        traits: cached.traits,
        source: cached.source,
        created_at: cached.created_at,
      });
    }

    const ratings = await ownRatings(eventId, userId);

    // Nothing of the caller's own to summarise. 404 rather than an empty recap: the app
    // shows the feedback panel in this state, and a blank card next to it would read as a
    // failure. It also says nothing about whether *others* submitted.
    if (ratings.length === 0) {
      throw new HttpError(
        404,
        "NO_FEEDBACK_YET",
        "Leave your feedback first and the recap will follow."
      );
    }

    const traits = await traitsByUser(ratings.map((row) => row.to_user));

    const rated: RatedMember[] = ratings.map((row) => ({
      rating: row.rating,
      traits: traits.get(row.to_user) ?? [],
    }));

    const summary = traitsFromRatings(rated);

    let profile: PublicUser;

    try {
      profile = await publicUser(userId);
    } catch {
      // A member row must exist to have passed requireMembership, but the language is
      // only used for wording — do not fail the recap over it.
      profile = { language: "en" } as PublicUser;
    }

    const language = profile.language ?? "en";
    const template = templateRecap(language, summary);

    // Over budget falls back to the template rather than 429ing: the member still gets a
    // real sentence, and the cheap path is the one being protected.
    //
    // An empty `liked` list also skips the model: rated people but nothing positive came
    // through, so `templateRecap` answers with the "quieter meetup" line. Sending Groq the
    // `cooled` traits in that state is why an all-meh rater once received a compliment for
    // exactly the members they disliked (TRACKER.md §5).
    const generated =
      summary.liked.length > 0 &&
      recapLimiter.take(userId) &&
      (await tryQuota(userId, "groq_turns", 500))
        ? await vibeRecap(recapPrompt(language, event.category, summary))
        : null;

    const recap = generated ?? template;
    const source: "ai" | "template" = generated ? "ai" : "template";

    // Cached on write so the next read is free. `onConflict` covers the race where the
    // app fires two recap requests (screen focus plus a refetch) before either finishes.
    const { data: saved, error: saveError } = await db()
      .from("meetup_recaps")
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          recap,
          traits: summary.liked,
          language,
          source,
        },
        { onConflict: "event_id,user_id" }
      )
      .select("recap, traits, source, created_at")
      .single<RecapRow>();

    if (saveError) throw dbError(saveError);

    return ok(res, {
      recap: saved.recap,
      traits: saved.traits,
      source: saved.source,
      created_at: saved.created_at,
    });
  })
);
