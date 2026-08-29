import { Soup, Gamepad2, Footprints, Coffee, Palette, Clapperboard, Music, Camera, Mountain, Moon, Users, Sparkles, Compass, Sunrise } from "lucide-react";

export const SITE = {
  name: "Atsumaru",
  nameJp: "集まる",
  tagline: "Gather around what you love.",
  description:
    "Atsumaru brings people together in small groups around shared interests, real activities, and low-pressure connections.",
  url: "https://atsumaru.app",
} as const;

export const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Why Atsumaru", href: "#why" },
  { label: "For Japan", href: "#japan" },
  { label: "Safety", href: "#safety" },
] as const;

export const PHOTOS = {
  hero: "https://images.unsplash.com/photo-1713970943504-04e8a3e3abac?fm=jpg&q=80&w=1600&auto=format&fit=crop",
  ramen: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&q=80",
  gaming: "https://images.unsplash.com/photo-1611371805429-8b5c1b2c34ba?w=800&q=80",
  hiking: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80",
  cafe: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80",
  art: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80",
  music: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
  photo: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80",
  cinema: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80",
  groupRamen: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
  groupCafe: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&q=80",
  groupHike: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80",
  tokyo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80",
  friends: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80",
  gathering: "https://images.unsplash.com/photo-1543807535-eceef0bc6599?w=1200&q=80",
  boardGames: "https://images.unsplash.com/photo-1611371805429-8b5c1b2c34ba?w=1200&q=80",
  cta: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1400&q=80",
} as const;

export const ACTIVITIES = [
  { icon: Soup, label: "Ramen nights", photo: PHOTOS.ramen },
  { icon: Gamepad2, label: "Board games", photo: PHOTOS.gaming },
  { icon: Footprints, label: "Weekend hikes", photo: PHOTOS.hiking },
  { icon: Coffee, label: "Café hopping", photo: PHOTOS.cafe },
  { icon: Palette, label: "Art & design", photo: PHOTOS.art },
  { icon: Clapperboard, label: "Anime / movies", photo: PHOTOS.cinema },
  { icon: Music, label: "Music", photo: PHOTOS.music },
  { icon: Camera, label: "Photography", photo: PHOTOS.photo },
] as const;

export const HOW_STEPS = [
  {
    num: "01",
    title: "Talk",
    desc: "Two minutes of chat instead of a profile form nobody wants to fill in.",
    photo: PHOTOS.cafe,
  },
  {
    num: "02",
    title: "Discover",
    desc: "Real plans on a map near you — tonight, this weekend, walkable.",
    photo: PHOTOS.tokyo,
  },
  {
    num: "03",
    title: "Gather",
    desc: "Land in a squad of 4–6 who are already into the same thing.",
    photo: PHOTOS.groupCafe,
  },
  {
    num: "04",
    title: "Meet",
    desc: "Show up, eat something good, play something dumb. No performance.",
    photo: PHOTOS.groupRamen,
  },
  {
    num: "05",
    title: "Connect",
    desc: "Clicked with someone? Only mutual picks unlock. Nobody gets rejected out loud.",
    photo: PHOTOS.friends,
  },
] as const;

export const AI_FLOW = {
  userSays:
    "I usually spend weekends hiking, trying small cafés, and playing board games with friends.",
  extracted: ["Hiking", "Coffee", "Board Games", "Chill", "Explorer"],
  match: {
    title: "Ramen & Retro Games",
    score: 91,
    reasons: [
      "Shared food & dining interests",
      "Board game & tabletop overlap",
      "Similar weekend social energy",
    ],
  },
} as const;

export const LANGUAGES = [
  { flag: "🇯🇵", name: "Japanese", code: "JP" },
  { flag: "🇬🇧", name: "English", code: "EN" },
  { flag: "🇨🇳", name: "Chinese", code: "中文" },
] as const;

/**
 * Kinetic tape ticker rows. Illustrative plans, not live data — the copy says
 * "sample plans" so the site never claims a feature that does not exist.
 */
export const TICKER_PULSES = [
  { city: "SHIBUYA", label: "Late-night ramen & vinyl 🍜", tag: "Tonight" },
  { city: "SHIMOKITA", label: "Thrift hunt & drip coffee ☕", tag: "Saturday" },
  { city: "AKIBA", label: "Smash Bros & retro arcade 🕹️", tag: "Friday" },
  { city: "YANAKA", label: "35mm film photo walk 📸", tag: "Sunday" },
  { city: "OSAKA", label: "Dotonbori street-food crawl 🐙", tag: "Saturday" },
  { city: "KYOTO", label: "Matcha & board games 🍵", tag: "Sunday" },
  { city: "SHINJUKU", label: "Bouldering, then ramen 🧗", tag: "Wednesday" },
  { city: "NAKAMEGURO", label: "Bookshop crawl & natural wine 📚", tag: "Thursday" },
] as const;

/**
 * Die-cut decals for the sticker sheet. `locked` slots are the ones tied to features on
 * the roadmap (docs/IDEA.md §10 gamification) — the section says so, so nothing here
 * claims a badge system that already ships.
 */
export const DECALS = [
  { label: "Ramen run", sub: "Shibuya", icon: Soup, bg: "#FF432A", fg: "#FFFFFF", tilt: -6, shape: "round" },
  { label: "Arcade crew", sub: "Akiba", icon: Gamepad2, bg: "#C8FF00", fg: "#09090B", tilt: 5, shape: "square" },
  { label: "Trail day", sub: "Takao", icon: Mountain, bg: "#5BE49B", fg: "#09090B", tilt: -3, shape: "shield" },
  { label: "Café hop", sub: "Nakameguro", icon: Coffee, bg: "#8A4FFF", fg: "#FFFFFF", tilt: 7, shape: "round" },
  { label: "Film walk", sub: "Yanaka", icon: Camera, bg: "#00F0FF", fg: "#09090B", tilt: -5, shape: "square" },
  { label: "Night owl", sub: "Golden Gai", icon: Moon, bg: "#FF2E93", fg: "#FFFFFF", tilt: 4, shape: "shield" },
  { label: "Gallery day", sub: "Kiyosumi", icon: Palette, bg: "#E4C25C", fg: "#09090B", tilt: -7, shape: "round" },
  { label: "First squad", sub: "Any city", icon: Users, bg: "#FAF7F2", fg: "#09090B", tilt: 3, shape: "square" },
  { label: "Streak x5", icon: Sparkles, tilt: -4, shape: "round", locked: true },
  { label: "Explorer", icon: Compass, tilt: 6, shape: "shield", locked: true },
  { label: "Early bird", icon: Sunrise, tilt: -5, shape: "square", locked: true },
  { label: "Regular", icon: Footprints, tilt: 4, shape: "round", locked: true },
] as const;

/** Vibe-matcher choices. `group` drives the squad name the toy generates. */export const VIBE_CHOICES = [
  { id: "ramen", label: "Late-night ramen 🍜", group: "Ramen" },
  { id: "arcade", label: "Retro arcade & Smash 🕹️", group: "Arcade" },
  { id: "coffee", label: "Specialty café crawl ☕", group: "Café" },
  { id: "film", label: "35mm street photos 📸", group: "Film" },
  { id: "boulder", label: "Bouldering & matcha 🧗", group: "Bouldering" },
  { id: "thrift", label: "Shimokita thrift hunt 🧥", group: "Thrift" },
  { id: "boardgames", label: "Board games & beer 🎲", group: "Board game" },
  { id: "gallery", label: "Galleries & vinyl 🎨", group: "Gallery" },
] as const;

/** Draggable hero stickers — luggage-tag energy, placed in the gaps between pills. */
export const HERO_STICKERS = [
  { text: "NO AWKWARD SWIPES", tone: "neon", pos: "left-[4%] bottom-[1%]", tilt: -7 },
  { text: "4–6 PEOPLE ONLY", tone: "lilac", pos: "right-[0%] top-[10%]", tilt: 6 },
  { text: "MUTUAL VIBES ONLY", tone: "pink", pos: "left-[-3%] bottom-[24%]", tilt: 5 },
  { text: "SHIBUYA 19:00", tone: "cyan", pos: "right-[3%] bottom-[9%]", tilt: -5 },
] as const;

/** Section copy, kept out of the JSX so tone edits stay in one file. */export const COPY = {
  hero: {
    kicker: "Not a dating app",
    sub: "Small groups. Real plans. Zero pressure.",
    subQuiet: "The app that gets you out of the group chat and into the world.",
  },
  problem: {
    heading: "Dating apps are",
    headingAccent: "cooked",
    sub: "Swiping is exhausting. Marriage apps are stressful. Nobody built the low-stakes middle where you just… hang out.",
  },
  how: {
    heading: "How to escape the",
    headingAccent: "group chat ghost town",
    sub: "Five steps, one evening, zero small talk about star signs.",
  },
  ai: {
    heading: "AI that actually",
    headingAccent: "passes the vibe check",
    sub: "Not a generic algorithm. A two-minute chat, then plans that sound like you.",
  },
  safety: {
    kicker: "Safety",
    heading: "Zero 1-on-1 cringe.",
    headingSecond: "Small squads only.",
    sub: "Group-first isn't a setting — it's the whole design.",
  },
  stickers: {
    kicker: "Sticker sheet",
    heading: "Every meetup is a",
    headingAccent: "decal",
    sub: "Every kind of gathering gets its own die-cut sticker. Tap one — the greyed-out slots are the collectible badges coming in a later release.",
    note: "Badges and streaks are on the roadmap, not in the first build.",
  },
  cta: {
    kicker: "Ready to gather?",
    sub: "No swiping. No pressure. No performance.\nJust plans with people who like what you like.",
  },
} as const;
