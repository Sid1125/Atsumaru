import type { SupabaseClient } from "@supabase/supabase-js";

import { authClient, supabase } from "./supabase.js";
import { dbError, HttpError } from "../utils/response.js";
import { parseVector } from "../utils/vector.js";
import type { Language } from "../types.js";

/** Public columns only — `real_name` is private and never leaves the server. */
export const PUBLIC_USER_COLUMNS =
  "id, handle, display_name, avatar_url, language, interests, personality, reputation_score, created_at";

export interface PublicUser {
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

export interface EventRow {
  id: string;
  host_id: string;
  title: string;
  category: string;
  description: string;
  venue_name: string;
  lat: number;
  lng: number;
  start_time: string;
  max_size: number;
  current_size: number;
  status: "open" | "full" | "ongoing" | "completed";
  distance_m?: number;
}

/** Public shape of an unlocked 1:1 (docs/API_STRUCTURE.md §2). */
export const CONNECTION_COLUMNS = "id, event_id, user_a, user_b, mutual, unlocked_at";

export interface ConnectionRow {
  id: string;
  event_id: string;
  user_a: string;
  user_b: string;
  mutual: boolean;
  unlocked_at: string | null;
}

export function db(): SupabaseClient {
  const client = supabase();

  if (!client) {
    throw new HttpError(503, "DB_UNAVAILABLE", "Supabase is not configured.");
  }

  return client;
}

/** Isolated client for session minting — see the warning in db/supabase.ts. */
export function authDb(): SupabaseClient {
  const client = authClient();

  if (!client) {
    throw new HttpError(503, "DB_UNAVAILABLE", "Supabase is not configured.");
  }

  return client;
}

/** RPC rows carry lat/lng as columns; the API contract nests them in `location`. */
export function toApiEvent(row: EventRow) {
  return {
    id: row.id,
    host_id: row.host_id,
    title: row.title,
    category: row.category,
    description: row.description,
    venue_name: row.venue_name,
    location: { lat: row.lat, lng: row.lng },
    start_time: row.start_time,
    max_size: row.max_size,
    current_size: Number(row.current_size),
    status: row.status,
  };
}

/** The public projection of one user; 404s rather than leaking an empty shape. */
export async function publicUser(userId: string): Promise<PublicUser> {
  const { data, error } = await db()
    .from("users")
    .select(PUBLIC_USER_COLUMNS)
    .eq("id", userId)
    .maybeSingle<PublicUser>();

  if (error) throw dbError(error);
  if (!data) throw new HttpError(404, "NOT_FOUND", "User not found.");

  return data;
}

export async function findEvent(eventId: string) {
  const { data, error } = await db()
    .rpc("event_detail", { p_event_id: eventId })
    .maybeSingle<EventRow>();

  if (error) throw dbError(error);
  if (!data) throw new HttpError(404, "NOT_FOUND", "Event not found.");

  return data;
}

export async function findMembers(eventId: string) {
  const { data, error } = await db()
    .from("group_members")
    .select(`id, event_id, user_id, joined_at, user:users (${PUBLIC_USER_COLUMNS})`)
    .eq("event_id", eventId)
    .order("joined_at", { ascending: true });

  if (error) throw dbError(error);

  return (data ?? []) as unknown as {
    id: string;
    event_id: string;
    user_id: string;
    joined_at: string;
    user: PublicUser;
  }[];
}

/** Group chat and feedback are members-only (docs/RULES.md §10). */
export async function requireMembership(eventId: string, userId: string) {
  const { data, error } = await db()
    .from("group_members")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw dbError(error);
  if (!data) throw new HttpError(403, "NOT_A_MEMBER", "You are not in this group.");
}

/** DMs are only reachable through an unlocked mutual connection. */
export async function requireConnection(connectionId: string, userId: string) {
  const { data, error } = await db()
    .from("connections")
    .select("id, user_a, user_b, mutual")
    .eq("id", connectionId)
    .maybeSingle<Pick<ConnectionRow, "id" | "user_a" | "user_b" | "mutual">>();

  if (error) throw dbError(error);

  if (!data || !data.mutual || (data.user_a !== userId && data.user_b !== userId)) {
    throw new HttpError(403, "NO_CONNECTION", "No unlocked connection.");
  }

  return data;
}

export interface MessageRow {
  id: string;
  event_id: string | null;
  connection_id: string | null;
  sender_id: string;
  message: string;
  created_at: string;
}

/**
 * Group and DM history share one table; `scope` picks the column to filter on.
 * Returns the paging envelope from docs/API_STRUCTURE.md §1.
 */
export async function listMessages(
  scope: "event_id" | "connection_id",
  id: string,
  page: number,
  limit: number
) {
  const from = (page - 1) * limit;

  const { data, error, count } = await db()
    .from("messages")
    .select("id, event_id, connection_id, sender_id, message, created_at", {
      count: "exact",
    })
    .eq(scope, id)
    // `created_at` alone is not a total order: a batch insert gives several rows the same
    // timestamp, which left their order arbitrary and let `range()` paging skip or repeat
    // one. `id` is unique, so adding it settles every tie the same way on every read.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + limit - 1);

  if (error) throw dbError(error);

  return {
    // Newest-first for paging, oldest-first for rendering.
    messages: ((data ?? []) as MessageRow[]).reverse(),
    page,
    limit,
    total: count ?? 0,
  };
}

export async function insertMessage(
  scope: "event_id" | "connection_id",
  id: string,
  senderId: string,
  message: string
) {
  const { data, error } = await db()
    .from("messages")
    .insert({ [scope]: id, sender_id: senderId, message })
    .select("id, event_id, connection_id, sender_id, message, created_at")
    .single<MessageRow>();

  if (error) throw dbError(error);

  return data;
}

export async function preferenceVector(userId: string): Promise<number[] | null> {
  const { data, error } = await db()
    .from("users")
    .select("preference_vector")
    .eq("id", userId)
    .maybeSingle<{ preference_vector: unknown }>();

  if (error) throw dbError(error);

  return parseVector(data?.preference_vector);
}
