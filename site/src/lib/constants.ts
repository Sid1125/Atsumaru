import { Soup, Gamepad2, Footprints, Coffee, Palette, Clapperboard, Music, Camera } from "lucide-react";

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
  { icon: Clapperboard, label: "Anime / movies", photo: PHOTOS.music },
  { icon: Music, label: "Music", photo: PHOTOS.photo },
  { icon: Camera, label: "Photography", photo: PHOTOS.friends },
] as const;

export const HOW_STEPS = [
  {
    num: "01",
    title: "Talk",
    desc: "Tell Atsumaru about yourself. A short AI chat replaces the boring profile form.",
    photo: PHOTOS.cafe,
  },
  {
    num: "02",
    title: "Discover",
    desc: "See meetups that fit your interests on a map nearby.",
    photo: PHOTOS.tokyo,
  },
  {
    num: "03",
    title: "Gather",
    desc: "Join a small group of 4–6 people around a shared activity.",
    photo: PHOTOS.groupCafe,
  },
  {
    num: "04",
    title: "Meet",
    desc: "Do something together in the real world. No pressure, just vibes.",
    photo: PHOTOS.groupRamen,
  },
  {
    num: "05",
    title: "Connect",
    desc: "If the feeling is mutual, keep talking. Your choices stay private.",
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
      "🍜 Shared food interests",
      "🎮 Gaming overlap",
      "☕ Similar social energy",
    ],
  },
} as const;

export const LANGUAGES = [
  { flag: "🇯🇵", name: "Japanese", code: "JP" },
  { flag: "🇬🇧", name: "English", code: "EN" },
  { flag: "🇨🇳", name: "Chinese", code: "中文" },
] as const;
