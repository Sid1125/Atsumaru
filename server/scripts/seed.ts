/**
 * Demo data for the appathon walkthrough (docs/FRONTEND.md §11): a map with pins, a
 * nearly-full group, a live chat, and one finished meetup whose feedback screen is one
 * tap away. Demo rows are isolated by their `demo+…@atsumaru.invalid` addresses.
 *
 *   npm run seed              # create or refresh the demo world
 *   npm run seed -- --tokens  # also print a usable access token per demo user
 *   npm run seed -- --reset   # delete the demo users (rows cascade) and stop
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env, hasSupabase } from "../src/config/env.js";
import { embed } from "../src/services/ai.js";
import { serializeVector } from "../src/utils/vector.js";
import type { Language } from "../src/types.js";

const DEMO_EMAIL_SUFFIX = "@atsumaru.invalid";

const emailFor = (handle: string) => `demo+${handle}${DEMO_EMAIL_SUFFIX}`;

const isDemoEmail = (email: string | undefined) =>
  !!email && email.startsWith("demo+") && email.endsWith(DEMO_EMAIL_SUFFIX);

interface DemoUser {
  handle: string;
  display_name: string;
  language: Language;
  interests: string[];
  personality: string[];
}

const USERS: DemoUser[] = [
  {
    handle: "trailbrew",
    display_name: "Yuki 🏔️",
    language: "en",
    interests: ["hiking", "coffee", "board games"],
    personality: ["chill", "explorer"],
  },
  {
    handle: "ramenkenji",
    display_name: "Kenji 🍜",
    language: "ja",
    interests: ["ramen", "retro games", "photography"],
    personality: ["outgoing", "curious"],
  },
  {
    handle: "harucafe",
    display_name: "Haru ☕",
    language: "ja",
    interests: ["coffee", "art", "ramen"],
    personality: ["quiet", "thoughtful"],
  },
  {
    handle: "mikaplays",
    display_name: "Mika 🎮",
    language: "en",
    interests: ["retro games", "board games", "anime"],
    personality: ["playful", "energetic"],
  },
  {
    handle: "linlens",
    display_name: "Lin 📷",
    language: "zh",
    interests: ["photography", "hiking", "coffee"],
    personality: ["observant", "calm"],
  },
  {
    handle: "sotaruns",
    display_name: "Sota 🏃",
    language: "ja",
    interests: ["running", "ramen", "hiking"],
    personality: ["energetic", "reliable"],
  },
];

/** Shibuya station; the app's fallback coordinates use the same point. */
const SHIBUYA = { lat: 35.6595, lng: 139.7005 };

const HOUR_MS = 60 * 60 * 1000;

interface DemoEvent {
  title: string;
  category: string;
  description: string;
  venue_name: string;
  /** Degrees offset from Shibuya, so the pins do not stack. */
  offset: { lat: number; lng: number };
  /** Hours from now; negative means it has already started. */
  startsInHours: number;
  max_size: number;
  host: string;
  members: string[];
  messages?: { from: string; message: string }[];
  /**
   * Feedback already submitted by other members. Picks aimed at the presenter's account
   * make the mutual-unlock payoff land on the first submission.
   */
  feedback?: { from: string; to: string; rating: "meh" | "good" | "fire" }[];
}

const EVENTS: DemoEvent[] = [
  {
    title: "Ramen & Retro Games",
    category: "food",
    description: "Slurp first, high scores after. Beginners very welcome.",
    venue_name: "Shibuya Yokocho",
    offset: { lat: 0.004, lng: 0.003 },
    startsInHours: 52,
    max_size: 6,
    host: "ramenkenji",
    members: ["ramenkenji", "harucafe"],
    messages: [
      { from: "ramenkenji", message: "Meeting by the Hachiko exit at 7!" },
      { from: "harucafe", message: "Perfect, I'll be the one with the tote bag ☕" },
    ],
  },
  {
    title: "Board Game Night",
    category: "gaming",
    description: "Five of us so far — one seat left before we start.",
    venue_name: "Jelly Jelly Cafe",
    offset: { lat: -0.003, lng: 0.005 },
    startsInHours: 74,
    max_size: 6,
    host: "mikaplays",
    members: ["mikaplays", "trailbrew", "linlens", "sotaruns", "harucafe"],
  },
  {
    title: "Sunset Photo Walk",
    category: "arts",
    description: "Golden hour around the backstreets. Any camera, phones included.",
    offset: { lat: 0.006, lng: -0.004 },
    venue_name: "Miyashita Park",
    startsInHours: -0.5,
    max_size: 5,
    host: "linlens",
    members: ["linlens", "trailbrew", "mikaplays"],
  },
  {
    title: "Morning Trail Run",
    category: "outdoor",
    description: "Easy 5k along the river, coffee afterwards.",
    venue_name: "Yoyogi Park Gate 2",
    offset: { lat: -0.007, lng: -0.002 },
    startsInHours: -3,
    max_size: 4,
    host: "sotaruns",
    members: ["sotaruns", "trailbrew", "harucafe", "ramenkenji"],
    messages: [
      { from: "sotaruns", message: "Great pace today everyone 🏃" },
      { from: "trailbrew", message: "That coffee stop was the real highlight" },
    ],
    // Two members already picked @trailbrew, so signing in as @trailbrew and submitting
    // feedback unlocks a mutual connection straight away.
    feedback: [
      { from: "harucafe", to: "trailbrew", rating: "fire" },
      { from: "ramenkenji", to: "trailbrew", rating: "fire" },
      { from: "harucafe", to: "sotaruns", rating: "good" },
    ],
  },
];

/** @trailbrew is the account the demo script signs in as (docs/DESIGN.md §4). */
const PRESENTER = "trailbrew";

function admin(): SupabaseClient {
  if (!hasSupabase) {
    console.error(
      "Seeding needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env."
    );
    process.exit(1);
  }

  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function check(error: { message: string } | null, what: string) {
  if (error) {
    console.error(`${what}: ${error.message}`);
    process.exit(1);
  }
}

/** Demo auth users, listed rather than blindly created so re-runs are cheap. */
async function demoAuthUsers(client: SupabaseClient) {
  const { data, error } = await client.auth.admin.listUsers({ perPage: 200 });

  check(error, "Could not list users");

  const byEmail = new Map<string, string>();

  for (const user of data.users) {
    if (isDemoEmail(user.email)) byEmail.set(user.email!, user.id);
  }

  return byEmail;
}

async function ensureAuthUser(
  client: SupabaseClient,
  existing: Map<string, string>,
  user: DemoUser
): Promise<string> {
  const email = emailFor(user.handle);
  const found = existing.get(email);

  if (found) return found;

  const { data, error } = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { demo: true, handle: user.handle },
  });

  check(error, `Could not create ${email}`);

  return data.user!.id;
}

/** Real vectors when a HuggingFace key is present; null is a valid fallback. */
async function vectorFor(user: DemoUser): Promise<string | null> {
  if (!env.HUGGINGFACE_API_KEY) return null;

  try {
    return serializeVector(
      await embed([...user.interests, ...user.personality].join(", "))
    );
  } catch (error) {
    console.warn(`  embedding skipped for @${user.handle}: ${(error as Error).message}`);
    return null;
  }
}

async function seedUsers(client: SupabaseClient): Promise<Map<string, string>> {
  const existing = await demoAuthUsers(client);
  const ids = new Map<string, string>();

  for (const user of USERS) {
    const id = await ensureAuthUser(client, existing, user);
    const preference_vector = await vectorFor(user);

    const { error } = await client.from("users").upsert(
      {
        id,
        handle: user.handle,
        display_name: user.display_name,
        language: user.language,
        interests: user.interests,
        personality: user.personality,
        location: `SRID=4326;POINT(${SHIBUYA.lng} ${SHIBUYA.lat})`,
        ...(preference_vector ? { preference_vector } : {}),
      },
      { onConflict: "id" }
    );

    check(error, `Could not save @${user.handle}`);

    ids.set(user.handle, id);
    console.log(`  @${user.handle}${preference_vector ? " (with vector)" : ""}`);
  }

  return ids;
}

/** Events are matched by host + title so a second run updates instead of duplicating. */
async function seedEvent(
  client: SupabaseClient,
  ids: Map<string, string>,
  event: DemoEvent
): Promise<string> {
  const hostId = ids.get(event.host)!;
  const startsAt = Date.now() + event.startsInHours * HOUR_MS;
  const isPast = event.startsInHours < 0;

  const row = {
    host_id: hostId,
    title: event.title,
    category: event.category,
    description: event.description,
    venue_name: event.venue_name,
    location: `SRID=4326;POINT(${SHIBUYA.lng + event.offset.lng} ${
      SHIBUYA.lat + event.offset.lat
    })`,
    start_time: new Date(startsAt).toISOString(),
    max_size: event.max_size,
    // Let event_status() derive ongoing/completed from start_time; only 'full' is stored.
    status: event.members.length >= event.max_size ? "full" : "open",
    // Past meetups are stamped as already handled, so the sweep does not immediately
    // notify or dock reputation for demo history. Rewind one to exercise that path.
    feedback_reminder_sent_at: isPast ? new Date(startsAt + HOUR_MS).toISOString() : null,
    reputation_settled_at: isPast
      ? new Date(startsAt + 2 * HOUR_MS).toISOString()
      : null,
  };

  const { data: found, error: findError } = await client
    .from("events")
    .select("id")
    .eq("host_id", hostId)
    .eq("title", event.title)
    .maybeSingle<{ id: string }>();

  check(findError, `Could not look up "${event.title}"`);

  let eventId = found?.id ?? null;

  if (eventId) {
    const { error } = await client.from("events").update(row).eq("id", eventId);
    check(error, `Could not update "${event.title}"`);
  } else {
    const { data, error } = await client
      .from("events")
      .insert(row)
      .select("id")
      .single<{ id: string }>();

    check(error, `Could not create "${event.title}"`);
    eventId = data!.id;
  }

  const { error: memberError } = await client.from("group_members").upsert(
    event.members.map((handle) => ({ event_id: eventId, user_id: ids.get(handle)! })),
    { onConflict: "event_id,user_id" }
  );

  check(memberError, `Could not add members to "${event.title}"`);

  await seedMessages(client, ids, eventId!, event);
  await seedFeedback(client, ids, eventId!, event);

  return eventId!;
}

/** Ratings from the other members; the presenter's own row stays absent on purpose. */
async function seedFeedback(
  client: SupabaseClient,
  ids: Map<string, string>,
  eventId: string,
  event: DemoEvent
) {
  if (!event.feedback?.length) return;

  const { error } = await client.from("feedback").upsert(
    event.feedback.map((entry) => ({
      event_id: eventId,
      from_user: ids.get(entry.from)!,
      to_user: ids.get(entry.to)!,
      rating: entry.rating,
      wants_connection: entry.to === PRESENTER,
      rejoin: true,
    })),
    { onConflict: "event_id,from_user,to_user" }
  );

  check(error, `Could not add feedback to "${event.title}"`);
}

/** Messages have no natural key, so they are written only when the chat is empty. */
async function seedMessages(
  client: SupabaseClient,
  ids: Map<string, string>,
  eventId: string,
  event: DemoEvent
) {
  if (!event.messages?.length) return;

  const { count, error } = await client
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  check(error, `Could not count messages for "${event.title}"`);

  if ((count ?? 0) > 0) return;

  const { error: insertError } = await client.from("messages").insert(
    event.messages.map((entry) => ({
      event_id: eventId,
      sender_id: ids.get(entry.from)!,
      message: entry.message,
    }))
  );

  check(insertError, `Could not add messages to "${event.title}"`);
}

/**
 * Short-lived access tokens for the demo users, so the app can be pointed at real data
 * before OAuth credentials exist. Same magic-link exchange the auth module uses.
 */
async function printTokens(client: SupabaseClient) {
  console.log("\nAccess tokens (expire with the project's JWT lifetime):");

  for (const user of USERS) {
    const email = emailFor(user.handle);

    const { data: link, error: linkError } = await client.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError || !link.properties?.hashed_token) {
      console.warn(`  @${user.handle}: ${linkError?.message ?? "no token"}`);
      continue;
    }

    const { data: session, error: verifyError } = await client.auth.verifyOtp({
      type: "email",
      token_hash: link.properties.hashed_token,
    });

    if (verifyError || !session.session) {
      console.warn(`  @${user.handle}: ${verifyError?.message ?? "no session"}`);
      continue;
    }

    console.log(`  @${user.handle}: ${session.session.access_token}`);
  }
}

async function reset(client: SupabaseClient) {
  const users = await demoAuthUsers(client);

  for (const [email, id] of users) {
    const { error } = await client.auth.admin.deleteUser(id);

    if (error) console.warn(`  could not delete ${email}: ${error.message}`);
    else console.log(`  deleted ${email}`);
  }

  console.log("Demo users removed; their events, messages and feedback cascaded.");
}

async function main() {
  const client = admin();
  const args = process.argv.slice(2);

  if (args.includes("--reset")) {
    await reset(client);
    return;
  }

  console.log("Seeding demo users…");
  const ids = await seedUsers(client);

  console.log("Seeding meetups…");

  for (const event of EVENTS) {
    const id = await seedEvent(client, ids, event);
    const when =
      event.startsInHours < 0
        ? `${Math.abs(event.startsInHours)}h ago`
        : `in ${event.startsInHours}h`;

    console.log(
      `  ${event.title} — ${event.members.length}/${event.max_size}, ${when} (${id})`
    );
  }

  if (args.includes("--tokens")) await printTokens(client);

  console.log(
    `\nDone. Map centre for /events/nearby: lat=${SHIBUYA.lat}&lng=${SHIBUYA.lng}` +
      `\nSign in as @${PRESENTER} to walk the demo: the finished meetup already has two` +
      `\nmembers who picked them, so submitting feedback unlocks a mutual connection.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});




