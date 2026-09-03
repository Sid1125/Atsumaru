/**
 * Demo request router — the server side of `EXPO_PUBLIC_DEMO_MODE=1`.
 *
 * `client.ts` hands every request here instead of axios when demo mode is on, so the
 * screens, hooks and query keys are byte-for-byte the same code that runs against the
 * real API. Turning demo mode off removes this module from the call path entirely.
 *
 * Responses match `docs/API_STRUCTURE.md` §3 exactly (the `data` half of the envelope —
 * `client.ts` has already unwrapped `{ success, data }` by the time callers see it).
 */

import { ApiError } from "../errors";
import type {
  ChatTurn,
  Connection,
  GroupMember,
  Language,
  MeetupEvent,
  Message,
  Rating,
  User,
  VibeRecap,
} from "../../../types/api";
import {
  COMPLETED_EVENT_ID,
  FEATURED_EVENT_ID,
  getWorld,
  listEvents,
  memberIds,
  toApiEvent,
  toGroupMembers,
  type EventSeed,
} from "./world";

// ── Matching (mirrors server/src/modules/matching/score.ts) ──────────────────

/**
 * Stands in for `cosine(user_preference, candidate_vector)`. Real matching embeds
 * interests with MiniLM; there is no embedding service offline, so overlap over the
 * interest/personality sets plays that role. The 0.6/0.2/0.2 weighting below is the
 * real one and must not drift from the server (docs/RULES.md §7).
 */
function similarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;

  const left = new Set(a.map((v) => v.toLowerCase()));
  const right = new Set(b.map((v) => v.toLowerCase()));
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;

  return shared / Math.sqrt(left.size * right.size);
}

function groupBalance(currentSize: number, maxSize: number): number {
  if (maxSize <= 0 || currentSize >= maxSize) return 0;
  return (currentSize + 1) / maxSize;
}

/** Mean pairwise tag similarity — mirrors `tagFit` in score.ts (docs/RULES.md §7). */
function tagFit(userTags: string[], memberTags: string[][]): number {
  const usable = memberTags.filter((tags) => tags.length > 0);
  if (userTags.length === 0 || usable.length === 0) return 0;

  const sum = usable.reduce((acc, tags) => acc + similarity(userTags, tags), 0);
  return sum / usable.length;
}

function matchScore(user: User, event: EventSeed): number {
  const others = memberIds(event.id).filter((id) => id !== user.id);
  const world = getWorld();

  // Pairwise, member by member — the same shape as the server's `fit` term.
  const memberTags = others.map((id) => {
    const member = world.users.get(id);
    return member ? [...member.interests, ...member.personality] : [];
  });

  const fit = tagFit([...user.interests, ...user.personality], memberTags);
  const reputation = Math.min(1, Math.max(0, user.reputation_score / 100));

  return (
    0.6 * fit +
    0.2 * groupBalance(memberIds(event.id).length, event.max_size) +
    0.2 * reputation
  );
}

const REASONS: Record<Language, {
  shared: (list: string) => string;
  spots: (c: number, m: number) => string;
  member: string;
}> = {
  en: {
    shared: (list) => `Shared interests: ${list}`,
    spots: (c, m) => `${c}/${m} spots taken`,
    member: "You are already in this group",
  },
  ja: {
    shared: (list) => `共通の興味: ${list}`,
    spots: (c, m) => `${m}人中${c}人が参加`,
    member: "すでにこのグループに参加しています",
  },
  zh: {
    shared: (list) => `共同兴趣：${list}`,
    spots: (c, m) => `已加入 ${c}/${m} 人`,
    member: "你已经在这个小组里",
  },
};

function matchReasons(user: User, event: EventSeed): string[] {
  const world = getWorld();
  const text = REASONS[user.language] ?? REASONS.en;
  const others = memberIds(event.id).filter((id) => id !== user.id);

  const shared = user.interests.filter((interest) =>
    others.some((id) => world.users.get(id)?.interests.includes(interest))
  );

  const reasons: string[] = [];
  if (shared.length > 0) reasons.push(text.shared(shared.join(", ")));
  reasons.push(text.spots(memberIds(event.id).length, event.max_size));
  if (others.length !== memberIds(event.id).length) reasons.push(text.member);

  return reasons;
}

// ── Vibe recap (mirrors server/src/modules/recap/vibe.ts) ────────────────────

/**
 * The template half of the recap only. There is no Groq offline, so demo mode always
 * takes the `source: "template"` path the server falls back to — which is the honest
 * thing to show: the card, the traits, and the privacy line are all real, and nothing
 * pretends a model ran.
 *
 * The weights and the trait ordering must match `traitsFromRatings` on the server; the
 * wording matches `templateRecap` (docs/AI.md §6a).
 */
const RATING_WEIGHT: Record<Rating, number> = { fire: 2, good: 1, meh: -1 };

const RECAP_TEXT: Record<
  Language,
  {
    clicked: (traits: string) => string;
    quiet: string;
    join: string;
    lastJoin: string;
  }
> = {
  en: {
    clicked: (traits) => `You clicked with people who love ${traits}.`,
    quiet: "A quieter meetup — your next group will tune to your taste.",
    join: ", ",
    lastJoin: " and ",
  },
  ja: {
    clicked: (traits) => `${traits}が好きな人と気が合ったようです。`,
    quiet: "今回は静かな集まりでした。次のグループはもっと好みに近づきます。",
    join: "、",
    lastJoin: "、",
  },
  zh: {
    clicked: (traits) => `你和喜欢${traits}的人很投缘。`,
    quiet: "这次比较安静，下一个小组会更贴近你的喜好。",
    join: "、",
    lastJoin: "、",
  },
};

/** The caller's own ratings → anonymised traits, strongest first, ties alphabetical. */
function recapTraits(user: User, eventId: string): string[] {
  const world = getWorld();
  const weights = new Map<string, number>();

  const own = world.feedback.filter(
    (row) => row.event_id === eventId && row.from_user === user.id
  );

  for (const row of own) {
    const rated = world.users.get(row.to_user);
    if (!rated) continue;

    const traits = new Set(
      [...rated.interests, ...rated.personality].map((t) => t.trim().toLowerCase())
    );

    for (const trait of traits) {
      weights.set(trait, (weights.get(trait) ?? 0) + RATING_WEIGHT[row.rating]);
    }
  }

  return [...weights.entries()]
    .filter(([, weight]) => weight >= 1)
    .sort(([aT, aW], [bT, bW]) => bW - aW || aT.localeCompare(bT))
    .slice(0, 3)
    .map(([trait]) => trait);
}

function buildRecap(user: User, eventId: string): VibeRecap {
  const traits = recapTraits(user, eventId);
  const text = RECAP_TEXT[user.language] ?? RECAP_TEXT.en;

  let recap: string;

  if (traits.length === 0) recap = text.quiet;
  else if (traits.length === 1) recap = text.clicked(traits[0]!);
  else {
    const listed = [...traits];
    const tail = listed.pop()!;
    recap = text.clicked(`${listed.join(text.join)}${text.lastJoin}${tail}`);
  }

  return { recap, traits, source: "template", created_at: new Date().toISOString() };
}

// ── Onboarding AI (scripted, but responsive to what the user typed) ──────────
const INTEREST_VOCAB: Record<string, string[]> = {
  hiking: ["hike", "hiking", "mountain", "trail", "outdoor", "山", "ハイキング"],
  coffee: ["coffee", "cafe", "café", "espresso", "roast", "コーヒー", "咖啡"],
  ramen: ["ramen", "noodle", "food", "eat", "ラーメン", "拉面"],
  "board games": ["board game", "boardgame", "catan", "tabletop", "ボードゲーム"],
  "retro games": ["retro", "arcade", "game", "gaming", "console", "ゲーム", "游戏"],
  photography: ["photo", "camera", "photography", "写真", "摄影"],
  anime: ["anime", "manga", "アニメ", "动漫"],
  art: ["art", "draw", "paint", "museum", "design", "アート", "艺术"],
  music: ["music", "band", "concert", "音楽", "音乐"],
  running: ["run", "running", "jog", "marathon", "ランニング"],
  traveling: ["travel", "trip", "abroad", "旅行", "旅游"],
  reading: ["read", "book", "novel", "読書", "阅读"],
  cooking: ["cook", "bake", "kitchen", "料理", "做饭"],
  film: ["movie", "film", "cinema", "映画", "电影"],
  cycling: ["cycle", "cycling", "bike", "自転車", "骑车"],
  gym: ["gym", "fitness", "workout", "strength", "ジム", "健身房"],
  yoga: ["yoga", "meditation", "stretch", "ヨガ", "瑜伽"],
  swimming: ["swim", "swimming", "pool", "水泳", "游泳"],
  camping: ["camp", "camping", "tent", "キャンプ", "露营"],
  climbing: ["climb", "bouldering", "クライミング", "攀岩"],
  karaoke: ["karaoke", "カラオケ", "卡拉ok"],
  izakaya: ["izakaya", "bar", "drinks", "居酒屋", "日式酒馆"],
  live: ["live", "concert", "festival", "ライブ", "现场"],
  fishing: ["fish", "fishing", "釣り", "钓鱼"],
  pets: ["pet", "dog", "cat", "ペット", "宠物"],
  skiing: ["ski", "snowboard", "スキー", "滑雪"],
  onsen: ["onsen", "spa", "hot spring", "温泉", "温泉"],
  volunteering: ["volunteer", "community", "ボランティア", "志愿"],
  gardening: ["garden", "plants", "ガーデニング", "园艺"],
};

// Mirrors the fixed onboarding chip vocabulary (`src/onboardingPersonality.ts`): each
// key carries its en/ja/zh labels so a tapped chip extracts in any language. Seeds
// keep their own tags; this map only drives the new user's own extraction.
const PERSONALITY_VOCAB: Record<string, string[]> = {
  bubbly: ["bubbly", "happy-go-lucky", "明るい", "开朗"],
  laidBack: ["laid-back", "laidback", "relaxed", "calm", "slow", "のんびり", "随和"],
  selfContained: ["self-contained", "selfcontained", "independent", "マイペース", "内敛"],
  outgoing: ["outgoing", "social", "people", "friends", "party", "社交的", "外向"],
  curious: ["curious", "learn", "try", "interested", "好奇心旺盛", "好奇"],
  energetic: ["energy", "energetic", "active", "sport", "元気いっぱい", "活力满满"],
  thoughtful: ["thoughtful", "considerate", "kind", "思いやりがある", "体贴"],
  adventurous: ["adventurous", "adventure", "explore", "travel", "冒険好き", "爱冒险"],
  creative: ["create", "make", "build", "creative", "design", "クリエイティブ", "有创意"],
  easygoing: ["easygoing", "easy-going", "気さく", "好相处"],
};

function extractFrom(text: string, vocab: Record<string, string[]>): string[] {
  const haystack = text.toLowerCase();
  return Object.entries(vocab)
    .filter(([, words]) => words.some((word) => haystack.includes(word)))
    .map(([label]) => label);
}

const FOLLOW_UPS: Record<Language, string[]> = {
  en: [
    "Nice! What does a good weekend look like for you?",          // 0: outdoor/activity
    "Do you cook or eat out more? Any favourite food spots?",     // 1: food
    "Which vibe fits you best from this list?",                   // 2: personality ask
    "Into anything creative — music, art, photography?",          // 3: creative
    "Ever travel somewhere just for food or a hobby meetup?",     // 4: travel
    "Do you prefer groups or one-on-one hangouts?",               // 5: social
    "What's something you'd love to try with a small group?",    // 6: wrap-up
  ],
  ja: [
    "いいですね！ 週末はどんなふうに過ごしますか？",
    "ご飯は自炊が多いですか、外食が多いですか？おすすめの食べ物はありますか？",
    "あなたの雰囲気を教えてください。以下から当てはまるものを選んでみてください。",
    "音楽やアート、写真などクリエイティブなことは好きですか？",
    "食べ物や趣味のMeetupのために旅行したりしたことはありますか？",
    "グループと一緒か、少人数の方がいいですか？",
    "最後に、少人数で挑戦してみたいことはありますか？",
  ],
  zh: [
    "不错！你周末一般都做些什么？",
    "你通常自己做饭还是在外面吃？有什么喜欢的餐厅或美食吗？",
    "能说说你的性格或风格吗？从下面选几个最像你的。",
    "有没有什么和艺术、音乐或摄影相关的爱好？",
    "你会因为某种美食或者兴趣活动专门去旅行吗？",
    "你更喜欢大群人一起玩，还是两三个人的局？",
    "最后一个问题：有什么想和小组一起尝试的事情吗？",
  ],
};

const LANGUAGE_ASK: Record<Language, string> = {
  en: "Before we start — which language should we chat in? Japanese (ja), English (en), or Chinese (zh)?",
  ja: "始める前に — どの言語で話しますか？日本語（ja）、英語（en）、中国語（zh）。",
  zh: "开始之前 — 你想用什么语言聊天？日语（ja）、英语（en）还是中文（zh）？",
};

const DONE_REPLY: Record<Language, string> = {
  en: "That's a great picture of you. Here's what I picked up — edit anything that's off.",
  ja: "あなたのことがよく分かりました。こちらが受け取った内容です。違うところは直してください。",
  zh: "我大致了解你了。这是我理解到的内容，有不对的地方可以修改。",
};

function onboardingChat(messages: ChatTurn[], language: Language) {
  const userTurns = messages.filter((turn) => turn.role === "user");
  const count = userTurns.length;
  const transcript = userTurns.map((turn) => turn.content).join(" ");
  const follow = FOLLOW_UPS[language] ?? FOLLOW_UPS.en;

  // First turn: ask which language to use, mirror the real host's first message.
  if (count === 1) {
    return {
      reply: LANGUAGE_ASK[language] ?? LANGUAGE_ASK.en,
      done: false,
      language,
    };
  }

  // Turn 2-3: probe different activity types (food, outdoor).
  if (count <= 3) {
    return { reply: follow[count - 2], done: false, language };
  }

  // Turn 4: the host asks the personality question, so show the trait tray.
  if (count === 4) {
    return {
      reply: follow[2],
      done: false,
      language,
      showPersonality: true,
    };
  }

  // Turns 5-8: probe creative / travel / social / wrap-up.
  if (count < 9) {
    return {
      reply: follow[Math.min(count - 2, follow.length - 1)]!,
      done: false,
      language,
    };
  }

  const interests = extractFrom(transcript, INTEREST_VOCAB);
  const personality = extractFrom(transcript, PERSONALITY_VOCAB);

  return {
    reply: DONE_REPLY[language] ?? DONE_REPLY.en,
    done: true,
    language,
    extracted: {
      // Never hand back an empty profile — the confirm screen needs something to show.
      interests: interests.length > 0 ? interests : ["coffee", "board games"],
      personality: personality.length > 0 ? personality : ["chill"],
    },
  };
}

// ── Unlock notifications (the mock socket subscribes to these) ───────────────

type UnlockListener = (connection: Connection) => void;
const unlockListeners = new Set<UnlockListener>();

export function onDemoUnlock(listener: UnlockListener) {
  unlockListeners.add(listener);
  return () => unlockListeners.delete(listener);
}

type DemoMessageListener = (message: Message) => void;
const messageListeners = new Set<DemoMessageListener>();

export function onDemoMessage(listener: DemoMessageListener) {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function emitDemoMessage(message: Message) {
  messageListeners.forEach((listener) => listener(message));
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const notFound = () => new ApiError("NOT_FOUND", "Not found in the demo world.", 404);

function requireUser(): User {
  const world = getWorld();
  const user = world.currentUserId ? world.users.get(world.currentUserId) : null;

  if (!user) throw new ApiError("UNAUTHORIZED", "Finish onboarding first.", 401);
  return user;
}

function findEvent(id: string): EventSeed {
  const seed = getWorld().events.get(id);
  if (!seed) throw notFound();
  return seed;
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function paginate(all: Message[], params: Record<string, unknown>) {
  const page = Number(params.page) > 0 ? Math.floor(Number(params.page)) : 1;
  const limit = Number(params.limit) > 0 ? Math.floor(Number(params.limit)) : 30;
  const ordered = [...all].sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Newest-first paging, oldest-first rendering — same contract as listMessages().
  const start = Math.max(0, ordered.length - page * limit);
  const end = ordered.length - (page - 1) * limit;

  return {
    messages: ordered.slice(start, Math.max(start, end)),
    page,
    limit,
    total: ordered.length,
  };
}

/** Latency makes loading states visible instead of flashing past. */
const settle = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), 180));

// ── Router ──────────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export async function demoRequest<T>(
  method: Method,
  url: string,
  payload?: Record<string, unknown> | unknown
): Promise<T> {
  const body = (payload ?? {}) as Record<string, unknown>;
  const world = getWorld();
  const path = url.split("?")[0]!;

  const seg = path.split("/").filter(Boolean);

  // ── auth ────────────────────────────────────────────────────────────────
  if (path === "/auth/me" && method === "GET") {
    const user = world.currentUserId ? world.users.get(world.currentUserId) : null;
    return settle({ user: user ?? null } as T);
  }

  if (path === "/auth/session" && method === "POST") {
    world.authenticated = true;
    return settle({
      access_token: "demo-access-token",
      refresh_token: "demo-refresh-token",
      user: world.currentUserId
        ? (world.users.get(world.currentUserId) ?? null)
        : null,
      is_new: world.currentUserId === null,
    } as T);
  }

  if (path === "/auth/logout" && method === "POST") {
    world.authenticated = false;
    return settle({ success: true } as T);
  }

  // ── users ───────────────────────────────────────────────────────────────
  if (path === "/users/me" && method === "GET") {
    return settle({ user: requireUser() } as T);
  }

  if (path === "/users/me" && method === "PATCH") {
    const user = requireUser();
    const next: User = {
      ...user,
      handle: (body.handle as string) ?? user.handle,
      display_name: (body.display_name as string) ?? user.display_name,
      avatar_url: (body.avatar_url as string | null) ?? user.avatar_url,
      language: (body.language as Language) ?? user.language,
      interests: (body.interests as string[]) ?? user.interests,
      personality: (body.personality as string[]) ?? user.personality,
    };
    world.users.set(user.id, next);
    return settle({ user: next } as T);
  }

  // Mirrors POST /users/me/avatar: in demo mode the data URL is stored as-is,
  // which RN's <Image> renders directly.
  if (path === "/users/me/avatar" && method === "POST") {
    const user = requireUser();
    const next: User = {
      ...user,
      avatar_url: (body.data_url as string) ?? user.avatar_url,
    };
    world.users.set(user.id, next);
    return settle({ user: next } as T);
  }

  if (path === "/users/me/push-token" && method === "POST") {
    world.pushToken = (body.token as string) ?? null;
    return settle({ success: true } as T);
  }

  // ── onboarding ──────────────────────────────────────────────────────────
  if (path === "/onboarding/chat" && method === "POST") {
    const messages = (body.messages as ChatTurn[]) ?? [];
    const language = (body.language as Language) ?? "en";
    return settle(onboardingChat(messages, language) as T);
  }

  if (path === "/onboarding/suggest-handles" && method === "GET") {
    const interests = String(body.interests ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const words = interests
      .flatMap((i) => i.toLowerCase().split(/[^a-z0-9]+/))
      .filter((w) => w.length >= 3);

    const taken = new Set([...world.users.values()].map((u) => u.handle));
    const ideas: string[] = [];

    for (const word of [...new Set(words)]) {
      ideas.push(word, `${word}ish`, `${word}club`, `${word}days`);
      for (const other of words) if (other !== word) ideas.push(`${word}${other}`);
    }

    return settle({
      handles: [...new Set(ideas)]
        .filter((h) => /^[a-z0-9_]{3,20}$/.test(h) && !taken.has(h))
        .slice(0, 6),
    } as T);
  }

  if (path === "/onboarding/check-handle" && method === "GET") {
    const raw = String(body.handle ?? "");
    const handle = raw.toLowerCase();
    const taken = new Set([...world.users.values()].map((u) => u.handle));

    // Mirror of the server: available only for a well-formed exact handle, plus
    // live alphanumeric variants of the typed base (e.g. "drivinggames_x4k92").
    const base = handle.replace(/[^a-z0-9_]/g, "").replace(/^_+|_+$/g, "").slice(0, 14);
    const variants: string[] = [];
    if (base && /^[a-z0-9_]+$/.test(base)) {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let salt = 0;
      while (variants.length < 4 && salt < 64) {
        const suffix = Array.from({ length: 5 }, () =>
          chars[(salt + variants.length * 7 + Math.floor(Math.random() * chars.length)) % chars.length]
        ).join("");
        const variant = `${base}_${suffix}`;
        if (!taken.has(variant) && !variants.includes(variant)) variants.push(variant);
        salt++;
      }
    }

    return settle({
      available: /^[a-z0-9_]{3,20}$/.test(handle) && !taken.has(handle),
      suggestions: variants,
    } as T);
  }

  if (path === "/onboarding/complete" && method === "POST") {
    const id = newId("u");
    const user: User = {
      id,
      handle: String(body.handle),
      display_name: String(body.display_name),
      avatar_url: null,
      language: (body.language as Language) ?? "en",
      interests: (body.interests as string[]) ?? [],
      personality: (body.personality as string[]) ?? [],
      reputation_score: 50,
      created_at: new Date().toISOString(),
    };

    world.users.set(id, user);
    world.currentUserId = id;

    // Adopt the new user into the seeded groups so the rest of the loop is
    // reachable — the same trick seed.ts uses to pre-stage a demo walkthrough.
    for (const eventId of [FEATURED_EVENT_ID, COMPLETED_EVENT_ID]) {
      if (!memberIds(eventId).includes(id)) {
        world.members.push({
          event_id: eventId,
          user_id: id,
          joined_at: new Date().toISOString(),
        });
      }
    }

    // @harucafe already wants to stay in touch, so the first honest feedback
    // submission produces a genuine mutual unlock rather than a scripted one.
    world.feedback.push({
      event_id: COMPLETED_EVENT_ID,
      from_user: "u-harucafe",
      to_user: id,
      rating: "fire",
      wants_connection: true,
    });

    return settle({ user } as T);
  }

  // ── events ──────────────────────────────────────────────────────────────
  if (path === "/events/nearby" && method === "GET") {
    const category = body.category ? String(body.category) : null;
    const events = listEvents()
      .map(toApiEvent)
      .filter((event) => event.status !== "completed")
      .filter((event) => !category || event.category === category);

    return settle({ events } as T);
  }

  if (path === "/events/mine" && method === "GET") {
    const user = requireUser();
    const events = listEvents()
      .filter(
        (seed) => seed.host_id === user.id || memberIds(seed.id).includes(user.id)
      )
      .map(toApiEvent);

    return settle({ events } as T);
  }

  if (path === "/events" && method === "POST") {
    const user = requireUser();
    const location = body.location as { lat: number; lng: number };
    const id = newId("e");

    const seed: EventSeed = {
      id,
      title: String(body.title),
      category: String(body.category),
      description: String(body.description ?? ""),
      venue_name: String(body.venue_name),
      offsetMs: Date.parse(String(body.start_time)) - Date.now(),
      max_size: Number(body.max_size) || 6,
      host_id: user.id,
      member_ids: [user.id],
      dx: location.lng - 139.7005,
      dy: location.lat - 35.6595,
    };

    world.events.set(id, seed);
    world.members.push({
      event_id: id,
      user_id: user.id,
      joined_at: new Date().toISOString(),
    });

    return settle({ event: toApiEvent(seed) } as T);
  }

  // /events/:id/...
  if (seg[0] === "events" && seg[1]) {
    const eventId = seg[1];
    const tail = seg[2];

    if (!tail && method === "GET") {
      const seed = findEvent(eventId);
      return settle({
        event: toApiEvent(seed),
        members: toGroupMembers(eventId),
      } as T);
    }

    if (tail === "members" && method === "GET") {
      findEvent(eventId);
      return settle({ members: toGroupMembers(eventId) } as T);
    }

    if (tail === "match-preview" && method === "GET") {
      const seed = findEvent(eventId);
      const user = requireUser();
      return settle({
        match_score: Math.round(matchScore(user, seed) * 100) / 100,
        why: matchReasons(user, seed),
      } as T);
    }

    // Same four gates as server/src/modules/recap/routes.ts, in the same order.
    if (tail === "recap" && method === "GET") {
      const seed = findEvent(eventId);
      const user = requireUser();

      if (!memberIds(eventId).includes(user.id)) {
        throw new ApiError("NOT_A_MEMBER", "You are not in this group.", 403);
      }

      if (toApiEvent(seed).status !== "completed") {
        throw new ApiError(
          "MEETUP_NOT_FINISHED",
          "The recap arrives once the meetup has finished.",
          409
        );
      }

      const cacheKey = `${eventId}:${user.id}`;
      const cached = world.recaps.get(cacheKey);

      if (cached) return settle(cached as T);

      // Derived from the caller's own ratings, so it does not exist until they submit.
      const own = world.feedback.filter(
        (row) => row.event_id === eventId && row.from_user === user.id
      );

      if (own.length === 0) {
        throw new ApiError(
          "NO_FEEDBACK_YET",
          "Leave your feedback first and the recap will follow.",
          404
        );
      }

      const recap = buildRecap(user, eventId);
      world.recaps.set(cacheKey, recap);

      return settle(recap as T);
    }

    if (tail === "join" && method === "POST") {
      const seed = findEvent(eventId);
      const user = requireUser();
      const size = memberIds(eventId).length;

      if (memberIds(eventId).includes(user.id)) {
        return settle({
          status: size >= seed.max_size ? "matched" : "joined",
          group_id: eventId,
        } as T);
      }

      if (eventStatusIsClosed(seed)) {
        throw new ApiError("EVENT_CLOSED", "This meetup is no longer open.", 409);
      }

      if (size >= seed.max_size) {
        throw new ApiError("EVENT_FULL", "This group is already full.", 409);
      }

      world.members.push({
        event_id: eventId,
        user_id: user.id,
        joined_at: new Date().toISOString(),
      });

      return settle({
        status: size + 1 >= seed.max_size ? "matched" : "joined",
        group_id: eventId,
      } as T);
    }

    if (tail === "leave" && method === "POST") {
      const seed = findEvent(eventId);
      const user = requireUser();

      if (seed.host_id === user.id) {
        throw new ApiError(
          "HOST_CANNOT_LEAVE",
          "The host cannot leave their own meetup.",
          403
        );
      }

      world.members = world.members.filter(
        (row) => !(row.event_id === eventId && row.user_id === user.id)
      );

      return settle({ success: true } as T);
    }

    if (tail === "messages" && method === "GET") {
      findEvent(eventId);
      const all = world.messages.filter((m) => m.event_id === eventId);
      return settle(paginate(all, body) as T);
    }

    if (tail === "messages" && method === "POST") {
      const user = requireUser();
      const message: Message = {
        id: newId("m"),
        event_id: eventId,
        connection_id: null,
        sender_id: user.id,
        message: String(body.message),
        created_at: new Date().toISOString(),
      };
      world.messages.push(message);
      return settle({ message } as T);
    }

    if (tail === "feedback-form" && method === "GET") {
      findEvent(eventId);
      const user = requireUser();
      return settle({
        members: toGroupMembers(eventId).filter((m) => m.user_id !== user.id),
      } as T);
    }

    if (tail === "feedback" && method === "POST") {
      findEvent(eventId);
      const user = requireUser();
      const ratings = (body.ratings as { to_user: string; rating: Rating }[]) ?? [];
      const picks = new Set((body.connect_with as string[]) ?? []);

      for (const entry of ratings) {
        world.feedback.push({
          event_id: eventId,
          from_user: user.id,
          to_user: entry.to_user,
          rating: entry.rating,
          wants_connection: picks.has(entry.to_user),
        });
      }

      // Mutual only: unlock where the other side already picked this user.
      // Non-mutual picks stay invisible — nothing about them is returned.
      const unlocked: Connection[] = [];

      for (const pick of picks) {
        const reciprocated = world.feedback.some(
          (row) =>
            row.event_id === eventId &&
            row.from_user === pick &&
            row.to_user === user.id &&
            row.wants_connection
        );

        if (!reciprocated) continue;

        const [user_a, user_b] = [user.id, pick].sort();
        const existing = world.connections.find(
          (c) => c.user_a === user_a && c.user_b === user_b && c.event_id === eventId
        );

        if (existing) {
          unlocked.push(existing);
          continue;
        }

        const connection: Connection = {
          id: newId("c"),
          event_id: eventId,
          user_a: user_a!,
          user_b: user_b!,
          mutual: true,
          unlocked_at: new Date().toISOString(),
        };

        world.connections.push(connection);
        unlocked.push(connection);
        unlockListeners.forEach((listener) => listener(connection));
      }

      return settle({ success: true, connections_unlocked: unlocked } as T);
    }
  }

  // ── connections ─────────────────────────────────────────────────────────
  if (path === "/connections" && method === "GET") {
    const user = requireUser();
    return settle({
      connections: world.connections.filter(
        (c) => c.mutual && (c.user_a === user.id || c.user_b === user.id)
      ),
    } as T);
  }

  if (seg[0] === "connections" && seg[1] && seg[2] === "messages") {
    const connectionId = seg[1];
    const user = requireUser();
    const connection = world.connections.find((c) => c.id === connectionId);

    if (!connection || (connection.user_a !== user.id && connection.user_b !== user.id)) {
      throw new ApiError("NO_CONNECTION", "No unlocked connection.", 403);
    }

    if (method === "GET") {
      const all = world.messages.filter((m) => m.connection_id === connectionId);
      return settle(paginate(all, body) as T);
    }

    if (method === "POST") {
      const message: Message = {
        id: newId("m"),
        event_id: null,
        connection_id: connectionId,
        sender_id: user.id,
        message: String(body.message),
        created_at: new Date().toISOString(),
      };
      world.messages.push(message);
      return settle({ message } as T);
    }
  }

  throw new ApiError(
    "NOT_IMPLEMENTED",
    `Demo mode has no handler for ${method} ${path}.`,
    501
  );
}

function eventStatusIsClosed(seed: EventSeed): boolean {
  return toApiEvent(seed).status !== "open";
}

/** Exposed so the mock socket can persist a message before broadcasting it. */
export function demoAppendMessage(message: Message) {
  getWorld().messages.push(message);
}

export function demoCurrentUser(): User | null {
  const world = getWorld();
  return world.currentUserId ? (world.users.get(world.currentUserId) ?? null) : null;
}

export type { GroupMember, MeetupEvent };
