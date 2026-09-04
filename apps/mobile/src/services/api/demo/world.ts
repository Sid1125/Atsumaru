/**
 * In-memory stand-in for the API, used when EXPO_PUBLIC_DEMO_MODE=1.
 *
 * This module plays the part of the *server*, so it deliberately holds business logic
 * that must never live in a component: match scoring, reputation, and mutual-only
 * connection unlocking. The scoring here mirrors
 * `server/src/modules/matching/score.ts` rather than inventing a second model
 * (docs/RULES.md §7) — if that formula changes, change it in both places.
 *
 * The cast of characters and the Shibuya meetups mirror `server/scripts/seed.ts` so a
 * demo run looks the same as a seeded run against real Supabase.
 *
 * Product rules still hold here: `real_name` does not exist in this world at all,
 * feedback is private, and a connection unlocks only when both sides picked each other.
 */

import type {
  Connection,
  GroupMember,
  Language,
  MeetupEvent,
  Message,
  NotificationPrefs,
  Rating,
  User,
  VibeRecap,
} from "../../../types/api";

const MEETUP_DURATION_MS = 2 * 60 * 60 * 1000;

const minutes = (n: number) => n * 60 * 1000;
const hours = (n: number) => n * 60 * minutes(1);

/** Shibuya station — the same point `seed.ts` and the app's fallback coords use. */
export const SHIBUYA = { lat: 35.6595, lng: 139.7005 };

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

// ── Seed cast ───────────────────────────────────────────────────────────────

interface SeedUser {
  id: string;
  handle: string;
  display_name: string;
  language: Language;
  interests: string[];
  personality: string[];
  reputation_score: number;
}

const SEED_USERS: SeedUser[] = [
  {
    id: "u-trailbrew",
    handle: "trailbrew",
    display_name: "Yuki 🏔️",
    language: "en",
    interests: ["hiking", "coffee", "board games"],
    personality: ["chill", "explorer"],
    reputation_score: 62,
  },
  {
    id: "u-ramenkenji",
    handle: "ramenkenji",
    display_name: "Kenji 🍜",
    language: "ja",
    interests: ["ramen", "retro games", "photography"],
    personality: ["outgoing", "curious"],
    reputation_score: 71,
  },
  {
    id: "u-harucafe",
    handle: "harucafe",
    display_name: "Haru ☕",
    language: "ja",
    interests: ["coffee", "art", "ramen"],
    personality: ["quiet", "thoughtful"],
    reputation_score: 68,
  },
  {
    id: "u-mikaplays",
    handle: "mikaplays",
    display_name: "Mika 🎮",
    language: "en",
    interests: ["retro games", "board games", "anime"],
    personality: ["playful", "energetic"],
    reputation_score: 55,
  },
  {
    id: "u-linlens",
    handle: "linlens",
    display_name: "Lin 📷",
    language: "zh",
    interests: ["photography", "hiking", "coffee"],
    personality: ["observant", "calm"],
    reputation_score: 64,
  },
  {
    id: "u-sotaruns",
    handle: "sotaruns",
    display_name: "Sota 🏃",
    language: "ja",
    interests: ["running", "ramen", "hiking"],
    personality: ["energetic", "reliable"],
    reputation_score: 58,
  },
];

function toUser(seed: SeedUser): User {
  return {
    id: seed.id,
    handle: seed.handle,
    display_name: seed.display_name,
    avatar_url: null,
    language: seed.language,
    interests: seed.interests,
    personality: seed.personality,
    reputation_score: seed.reputation_score,
    created_at: iso(-hours(24 * 30)),
  };
}

// ── Mutable world state ─────────────────────────────────────────────────────

interface FeedbackRow {
  event_id: string;
  from_user: string;
  to_user: string;
  rating: Rating;
  wants_connection: boolean;
}

interface EventSeed {
  id: string;
  title: string;
  category: string;
  description: string;
  venue_name: string;
  offsetMs: number;
  max_size: number;
  host_id: string;
  member_ids: string[];
  /** Metres from Shibuya, so the map pins are not all stacked on one point. */
  dx: number;
  dy: number;
}

const EVENT_SEEDS: EventSeed[] = [
  {
    id: "e-ramen-retro",
    title: "Ramen & Retro Games",
    category: "food",
    description:
      "Slurp first, then two hours of arcade cabinets upstairs. Beginners welcome.",
    venue_name: "Nonbei Yokocho",
    offsetMs: hours(30),
    max_size: 6,
    host_id: "u-ramenkenji",
    member_ids: ["u-ramenkenji", "u-harucafe", "u-mikaplays", "u-sotaruns", "u-linlens"],
    dx: 0.004,
    dy: 0.002,
  },
  {
    id: "e-morning-hike",
    title: "Morning Hike & Coffee",
    category: "outdoor",
    description: "Easy trail, good views, better coffee at the end. Early start.",
    venue_name: "Takao Trailhead Meetup",
    offsetMs: hours(54),
    max_size: 6,
    host_id: "u-linlens",
    member_ids: ["u-linlens", "u-sotaruns"],
    dx: -0.006,
    dy: 0.005,
  },
  {
    id: "e-board-games",
    title: "Board Game Night",
    category: "gaming",
    description: "Catan, Codenames, and whatever else fits on the table.",
    venue_name: "Jelly Jelly Cafe",
    offsetMs: -minutes(35),
    max_size: 5,
    host_id: "u-mikaplays",
    member_ids: ["u-mikaplays", "u-ramenkenji", "u-harucafe"],
    dx: 0.002,
    dy: -0.005,
  },
  {
    id: "e-cafe-crawl",
    title: "Shibuya Café Crawl",
    category: "food",
    description: "Three roasters, one afternoon, strong opinions about milk.",
    venue_name: "Fuglen Tokyo",
    offsetMs: -hours(26),
    max_size: 6,
    host_id: "u-harucafe",
    member_ids: ["u-harucafe", "u-linlens", "u-ramenkenji"],
    dx: -0.003,
    dy: -0.003,
  },
  {
    id: "e-live-jam",
    title: "Beginner Jam Session",
    category: "music",
    description: "Bring whatever you play — or just listen. No experience needed.",
    venue_name: "Shimokita Echo",
    offsetMs: hours(48),
    max_size: 6,
    host_id: "u-mikaplays",
    member_ids: ["u-mikaplays", "u-linlens"],
    dx: 0.006,
    dy: 0.001,
  },
  {
    id: "e-yoga-rooftop",
    title: "Rooftop Yoga & Smoothies",
    category: "wellness",
    description: "Gentle morning flow, then cold-pressed smoothies on the roof.",
    venue_name: "Miyashita Park Rooftop",
    offsetMs: hours(72),
    max_size: 6,
    host_id: "u-harucafe",
    member_ids: ["u-harucafe", "u-sotaruns", "u-mikaplays"],
    dx: 0.001,
    dy: 0.006,
  },
  {
    id: "e-train-kamakura",
    title: "Day Trip: Kamakura",
    category: "travel",
    description: "Temples, the coastline, and onigiri on the platform.",
    venue_name: "Kamakura Station",
    offsetMs: hours(96),
    max_size: 6,
    host_id: "u-linlens",
    member_ids: ["u-linlens", "u-ramenkenji"],
    dx: -0.008,
    dy: -0.002,
  },
  {
    id: "e-language-cafe",
    title: "Language Exchange Café",
    category: "learning",
    description: "Half English, half Japanese, all friendly. All levels.",
    venue_name: "Shinjuku Bit Cafeteria",
    offsetMs: hours(120),
    max_size: 6,
    host_id: "u-sotaruns",
    member_ids: ["u-sotaruns", "u-harucafe", "u-linlens", "u-mikaplays"],
    dx: 0.003,
    dy: -0.008,
  },
  {
    id: "e-badminton",
    title: "Pickup Badminton",
    category: "sports",
    description: "Casual doubles, rotating partners, zero pressure.",
    venue_name: "Yoyogi Sports Hall",
    offsetMs: hours(144),
    max_size: 6,
    host_id: "u-ramenkenji",
    member_ids: ["u-ramenkenji", "u-sotaruns"],
    dx: -0.002,
    dy: 0.008,
  },
];

/** The completed meetup the demo user is adopted into, so feedback is reachable. */
export const COMPLETED_EVENT_ID = "e-cafe-crawl";

/** The upcoming meetup the demo user is adopted into, so group chat is reachable. */
export const FEATURED_EVENT_ID = "e-ramen-retro";

interface WorldState {
  users: Map<string, User>;
  events: Map<string, EventSeed>;
  members: { event_id: string; user_id: string; joined_at: string }[];
  messages: Message[];
  feedback: FeedbackRow[];
  connections: Connection[];
  /** Cached vibe recaps, keyed `${event_id}:${user_id}` — see demo/index.ts. */
  recaps: Map<string, VibeRecap>;
  /** The signed-in user's id, or null before onboarding completes. */
  currentUserId: string | null;
  /** Set at demo sign-in; the profile row appears only after onboarding. */
  authenticated: boolean;
  pushToken: string | null;
  /** Per-type push opt-outs, so the settings toggles are real state here too. */
  notificationPrefs: NotificationPrefs;
}

/**
 * Held on globalThis rather than in a module binding so Fast Refresh cannot wipe it.
 * Re-evaluating this module during development would otherwise reset the world while
 * the Zustand auth store kept the signed-in user, leaving the app pointing at a
 * profile the "server" no longer knows about.
 */
const WORLD_KEY = "__atsumaru_demo_world__";

type GlobalWithWorld = typeof globalThis & { [WORLD_KEY]?: WorldState };

export function resetWorld() {
  const users = new Map<string, User>();
  for (const seed of SEED_USERS) users.set(seed.id, toUser(seed));

  const events = new Map<string, EventSeed>();
  for (const seed of EVENT_SEEDS) events.set(seed.id, seed);

  const members = EVENT_SEEDS.flatMap((event) =>
    event.member_ids.map((user_id, index) => ({
      event_id: event.id,
      user_id,
      joined_at: iso(-hours(48) + minutes(index * 7)),
    }))
  );

  const messages: Message[] = [
    msg("m1", "e-ramen-retro", "u-ramenkenji", "Booked the counter for 7pm 🍜", -hours(5)),
    msg("m2", "e-ramen-retro", "u-mikaplays", "Perfect. I'm bringing coins for the cabinets", -hours(4)),
    msg("m3", "e-ramen-retro", "u-harucafe", "See you all there!", -hours(3)),
    msg("m4", "e-board-games", "u-mikaplays", "Table's ready whenever you are", -minutes(50)),
  ];

  // Pre-seeded so the demo user's first feedback submission produces a real mutual
  // unlock: @harucafe already picked them (mirrors seed.ts).
  const feedback: FeedbackRow[] = [];

  (globalThis as GlobalWithWorld)[WORLD_KEY] = {
    users,
    events,
    members,
    messages,
    feedback,
    connections: [],
    recaps: new Map(),
    currentUserId: null,
    authenticated: false,
    pushToken: null,
    notificationPrefs: {
      feedback: true,
      meetup_soon: true,
      chat: true,
      nearby: true,
      reengagement: true,
    },
  };
}

function msg(
  id: string,
  event_id: string,
  sender_id: string,
  message: string,
  offsetMs: number
): Message {
  return {
    id,
    event_id,
    connection_id: null,
    sender_id,
    message,
    created_at: iso(offsetMs),
  };
}

// Seeded once per app launch; a Fast Refresh finds the existing world and keeps it.
if (!(globalThis as GlobalWithWorld)[WORLD_KEY]) resetWorld();

export const getWorld = (): WorldState =>
  (globalThis as GlobalWithWorld)[WORLD_KEY]!;

// ── Derived shapes ──────────────────────────────────────────────────────────

/** Mirrors `event_status()` in schema.sql — never recomputed in a component. */
export function eventStatus(seed: EventSeed): MeetupEvent["status"] {
  const start = Date.now() + seed.offsetMs;
  const size = memberIds(seed.id).length;

  if (Date.now() >= start + MEETUP_DURATION_MS) return "completed";
  if (Date.now() >= start) return "ongoing";
  return size >= seed.max_size ? "full" : "open";
}

export function memberIds(eventId: string): string[] {
  return getWorld().members
    .filter((row) => row.event_id === eventId)
    .map((row) => row.user_id);
}

export function toApiEvent(seed: EventSeed): MeetupEvent {
  return {
    id: seed.id,
    host_id: seed.host_id,
    title: seed.title,
    category: seed.category,
    description: seed.description,
    venue_name: seed.venue_name,
    location: { lat: SHIBUYA.lat + seed.dy, lng: SHIBUYA.lng + seed.dx },
    start_time: iso(seed.offsetMs),
    max_size: seed.max_size,
    current_size: memberIds(seed.id).length,
    status: eventStatus(seed),
  };
}

export function toGroupMembers(eventId: string): GroupMember[] {
  return getWorld().members
    .filter((row) => row.event_id === eventId)
    .map((row) => {
      const user = getWorld().users.get(row.user_id)!;
      return {
        id: `${eventId}:${row.user_id}`,
        event_id: eventId,
        user_id: row.user_id,
        user,
        joined_at: row.joined_at,
      };
    })
    .filter((member): member is GroupMember => Boolean(member.user));
}

export function listEvents(): EventSeed[] {
  return [...getWorld().events.values()];
}

export type { EventSeed, FeedbackRow };
