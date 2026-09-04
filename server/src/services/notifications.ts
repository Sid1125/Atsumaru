/**
 * The one door every push goes through (docs/TRD.md §14).
 *
 * `push.ts` knows how to talk to Expo; this knows whether a given member should be
 * disturbed at all. Keeping that in one place is the point: five notification types with
 * their own copies of the opt-out, quiet-hours and cap checks would eventually disagree,
 * and the failure mode is a member who muted something still receiving it.
 *
 * Order matters. Quiet hours first because it is free, then the opt-out, then the daily
 * cap — the cap *consumes* budget, so it must not be spent on a notification that a
 * cheaper check would have dropped.
 */

import { db } from "../db/queries.js";
import { dbError } from "../utils/response.js";
import { tryQuota, type QuotaResource } from "../utils/quota.js";
import {
  nearbyMessage,
  sendPush,
  pushTargets,
  type PushMessage,
  type PushTarget,
} from "./push.js";

export type NotificationType =
  | "feedback"
  | "meetup_soon"
  | "chat"
  | "nearby"
  | "reengagement";

/**
 * Whether a type is allowed to arrive in the middle of the night, and what it costs.
 *
 * `feedback` and `meetup_soon` are consequences of something the member chose to do, so
 * they are not held back — a reminder that arrives after the meetup it was reminding
 * about is worse than a late buzz. `chat` is exempt for the same reason every messaging
 * app is: a real message held until morning reads as the app being broken.
 *
 * `nearby` and `reengagement` are the two the member never asked for, so they are the two
 * that wait until morning and carry a daily ceiling.
 */
interface TypePolicy {
  quietHours: boolean;
  /** Absent when the type is bounded by something else (an idempotency stamp). */
  quota?: { resource: QuotaResource; perDay: number };
}

const POLICY: Record<NotificationType, TypePolicy> = {
  feedback: { quietHours: false },
  meetup_soon: { quietHours: false },
  chat: {
    quietHours: false,
    quota: { resource: "notif_chat", perDay: 30 },
  },
  nearby: {
    quietHours: true,
    quota: { resource: "notif_nearby", perDay: 2 },
  },
  reengagement: {
    quietHours: true,
    quota: { resource: "notif_reengagement", perDay: 1 },
  },
};

/** Read-only view of a type's policy, so a test can pin these product decisions. */
export function policyFor(type: NotificationType): Readonly<TypePolicy> {
  return POLICY[type];
}

/** JST is UTC+9 all year — no DST to get wrong. */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const QUIET_FROM_HOUR = 22;
const QUIET_UNTIL_HOUR = 8;

/**
 * True between 22:00 and 08:00 JST. The product is Japan-first, so quiet hours are
 * evaluated in Tokyo time rather than the server's or the member's device timezone —
 * `users` has no timezone column, and inferring one from `language` would be wrong for
 * every English speaker living in Tokyo.
 */
export function isQuietHour(now: number): boolean {
  const hour = new Date(now + JST_OFFSET_MS).getUTCHours();

  // The window wraps midnight, so this is an OR rather than a range.
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

/** Users who have switched this type off. Absent row means enabled. */
async function mutedUsers(
  type: NotificationType,
  userIds: string[]
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const { data, error } = await db()
    .from("notification_prefs")
    .select("user_id")
    .eq("type", type)
    .eq("enabled", false)
    .in("user_id", userIds);

  if (error) throw dbError(error);

  return new Set(((data ?? []) as { user_id: string }[]).map((row) => row.user_id));
}

/**
 * Sends one notification type to a set of members, dropping anyone who has muted it, is
 * asleep, or is over their daily ceiling. Returns how many messages Expo accepted.
 *
 * `build` receives one target per *device*, so a member with a phone and a tablet gets two
 * messages — but is only charged one unit of quota, because the cap is about how often the
 * person is disturbed, not how many devices they own.
 */
export async function notify(
  type: NotificationType,
  userIds: string[],
  build: (target: PushTarget) => PushMessage,
  now = Date.now()
): Promise<number> {
  if (userIds.length === 0) return 0;

  const policy = POLICY[type];

  if (policy.quietHours && isQuietHour(now)) return 0;

  const muted = await mutedUsers(type, userIds);
  const allowed = userIds.filter((id) => !muted.has(id));

  if (allowed.length === 0) return 0;

  // Charged per person, before targets are expanded per device.
  const withBudget: string[] = [];

  for (const userId of allowed) {
    if (!policy.quota) {
      withBudget.push(userId);
      continue;
    }

    if (await tryQuota(userId, policy.quota.resource, policy.quota.perDay)) {
      withBudget.push(userId);
    }
  }

  if (withBudget.length === 0) return 0;

  const targets = await pushTargets(withBudget);

  if (targets.length === 0) return 0;

  return await sendPush(targets.map(build));
}

/** City-scale, matching the discovery radius the app defaults to. */
const NEARBY_RADIUS_M = 5000;

/**
 * How old a stored location may be and still be used. `docs/RULES.md` keeps location
 * one-shot with no background tracking, so the point here is whatever the member's last
 * session happened to record — past a week it says more about where they were than where
 * they are, and a nudge about the wrong city is worse than no nudge.
 */
const NEARBY_LOCATION_MAX_AGE_DAYS = 7;

interface NearbyEvent {
  title: string;
  venue_name: string;
}

/**
 * Tells nearby members about a meetup that has just opened.
 *
 * Driven per created event rather than per user: `events_nearby_users` does the radius
 * filter, the freshness bound, the host/member exclusions and the limit in one statement,
 * so a new meetup costs one query instead of a scan per member on every sweep pass.
 *
 * Best-effort by contract — the caller creates the meetup and does not wait for this.
 */
export async function notifyNearbyMeetup(
  eventId: string,
  now = Date.now()
): Promise<number> {
  const { data: nearby, error } = await db().rpc("events_nearby_users", {
    p_event_id: eventId,
    p_radius: NEARBY_RADIUS_M,
    p_max_age_days: NEARBY_LOCATION_MAX_AGE_DAYS,
  });

  if (error) throw dbError(error);

  const userIds = ((nearby ?? []) as { user_id: string }[]).map((row) => row.user_id);

  if (userIds.length === 0) return 0;

  const { data: event, error: eventError } = await db()
    .from("events")
    .select("title, venue_name")
    .eq("id", eventId)
    .maybeSingle<NearbyEvent>();

  if (eventError) throw dbError(eventError);
  if (!event) return 0;

  return await notify(
    "nearby",
    userIds,
    (target) =>
      nearbyMessage(
        target.token,
        eventId,
        event.title,
        event.venue_name,
        target.language
      ),
    now
  );
}
