// Domain types mirroring docs/API_STRUCTURE.md §2 (public shapes only).
// `real_name` is intentionally absent: it is private and never rendered.

export type Language = "ja" | "en" | "zh";

export type EventStatus = "open" | "full" | "ongoing" | "completed";

export type Rating = "meh" | "good" | "fire";

export interface Coords {
  lat: number;
  lng: number;
}

export interface User {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  language: Language;
  interests: string[];
  personality: string[];
  reputation_score: number;
  created_at: string;
}

export interface MeetupEvent {
  id: string;
  host_id: string;
  title: string;
  category: string;
  description: string;
  venue_name: string;
  location: Coords;
  start_time: string;
  max_size: number;
  current_size: number;
  status: EventStatus;
}

export interface GroupMember {
  id: string;
  event_id: string;
  user_id: string;
  user: User;
  joined_at: string;
}

/**
 * Group and DM history share one table server-side; exactly one of `event_id` /
 * `connection_id` is set (enforced by a CHECK constraint in schema.sql), so both are
 * nullable here. Typing `event_id` as a plain string made DM messages unassignable.
 */
export interface Message {
  id: string;
  event_id: string | null;
  connection_id: string | null;
  sender_id: string;
  message: string;
  created_at: string;
}

export interface Feedback {
  id: string;
  event_id: string;
  from_user: string;
  to_user: string;
  rating: Rating;
  created_at: string;
}

export interface Connection {
  id: string;
  event_id: string;
  user_a: string;
  user_b: string;
  mutual: boolean;
  unlocked_at: string | null;
}

export interface MatchPreview {
  match_score: number;
  why: string[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface OnboardingChatResult {
  reply: string;
  done: boolean;
  extracted?: {
    interests: string[];
    personality: string[];
  };
}

/** Message list responses keep their `messages` key plus the paging envelope. */
export interface MessagePage {
  messages: Message[];
  page: number;
  limit: number;
  total: number;
}
