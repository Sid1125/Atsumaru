import { io, Socket } from "socket.io-client";

import { DEMO_MODE, WS_URL } from "../../config/env";
import { getAccessToken } from "../storage/session";
import {
  demoAppendMessage,
  demoCurrentUser,
  onDemoMessage,
  onDemoUnlock,
  emitDemoMessage,
} from "../api/demo";
import { getWorld, memberIds } from "../api/demo/world";
import type { Connection, Message, User } from "../../types/api";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

type ServerEvents = {
  "group:message": (message: Message) => void;
  "dm:message": (message: Message) => void;
  "member:joined": (payload: { event_id: string; user: User }) => void;
  "match:unlocked": (connection: Connection) => void;
  typing: (payload: { room_id: string; user_id: string }) => void;
};

let socket: Socket | null = null;
let status: ConnectionStatus = "idle";
const statusListeners = new Set<(s: ConnectionStatus) => void>();

function setStatus(next: ConnectionStatus) {
  status = next;
  statusListeners.forEach((listener) => listener(next));
}

// ── Demo transport ──────────────────────────────────────────────────────────
// Mirrors the server's contract in docs/API_STRUCTURE.md §4: persist before
// broadcasting, so REST history and the live stream never disagree.

const demoHandlers = new Map<string, Set<(payload: unknown) => void>>();
let demoWired = false;

function demoEmitLocal(event: string, payload: unknown) {
  demoHandlers.get(event)?.forEach((handler) => handler(payload));
}

function wireDemoBridge() {
  if (demoWired) return;
  demoWired = true;

  onDemoMessage((message) => {
    demoEmitLocal(message.connection_id ? "dm:message" : "group:message", message);
  });

  onDemoUnlock((connection) => demoEmitLocal("match:unlocked", connection));
}

const REPLIES = [
  "Sounds good to me 👍",
  "Nice, see you there!",
  "I'm in — just finishing work",
  "Perfect timing 🙌",
];

/**
 * Demo-only: a groupmate answers a moment later so the chat screen demonstrates a
 * live inbound message, not just the echo of what was typed.
 */
function scheduleDemoReply(eventId: string) {
  const world = getWorld();
  const me = demoCurrentUser();
  const others = memberIds(eventId).filter((id) => id !== me?.id);
  const responder = others[Math.floor(Math.random() * others.length)];

  if (!responder) return;

  setTimeout(() => {
    const message: Message = {
      id: `m-${Math.random().toString(36).slice(2, 10)}`,
      event_id: eventId,
      connection_id: null,
      sender_id: responder,
      message: REPLIES[Math.floor(Math.random() * REPLIES.length)]!,
      created_at: new Date().toISOString(),
    };
    demoAppendMessage(message);
    emitDemoMessage(message);
  }, 1400);

  void world;
}

// ── Public API (identical surface in both modes) ────────────────────────────

/** One shared authenticated socket for the whole app (docs/FRONTEND.md §7). */
export async function connectSocket(): Promise<Socket | null> {
  if (DEMO_MODE) {
    wireDemoBridge();
    setStatus("connected");
    return null;
  }

  if (socket?.connected) return socket;

  const token = await getAccessToken();

  if (!socket) {
    socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      autoConnect: false,
    });

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.io.on("reconnect_attempt", () => setStatus("connecting"));
  } else {
    socket.auth = { token };
  }

  setStatus("connecting");
  socket.connect();

  return socket;
}

export function disconnectSocket() {
  if (DEMO_MODE) {
    demoHandlers.clear();
    setStatus("idle");
    return;
  }

  socket?.disconnect();
  socket = null;
  setStatus("idle");
}

export function getSocketStatus() {
  return status;
}

export function onSocketStatus(listener: (s: ConnectionStatus) => void) {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}

/** Subscribe to a server event; returns an unsubscribe so effects can clean up. */
export function onServerEvent<K extends keyof ServerEvents>(
  event: K,
  handler: ServerEvents[K]
): () => void {
  if (DEMO_MODE) {
    const key = event as string;
    const set = demoHandlers.get(key) ?? new Set();
    set.add(handler as (payload: unknown) => void);
    demoHandlers.set(key, set);
    return () => {
      demoHandlers.get(key)?.delete(handler as (payload: unknown) => void);
    };
  }

  socket?.on(event as string, handler as (...args: unknown[]) => void);
  return () => {
    socket?.off(event as string, handler as (...args: unknown[]) => void);
  };
}

export const socketActions = {
  joinGroup: (event_id: string) => {
    if (DEMO_MODE) return;
    socket?.emit("group:join", { event_id });
  },

  sendGroupMessage: (event_id: string, message: string) => {
    if (DEMO_MODE) {
      const me = demoCurrentUser();
      if (!me) return;

      const saved: Message = {
        id: `m-${Math.random().toString(36).slice(2, 10)}`,
        event_id,
        connection_id: null,
        sender_id: me.id,
        message,
        created_at: new Date().toISOString(),
      };

      demoAppendMessage(saved);
      emitDemoMessage(saved);
      scheduleDemoReply(event_id);
      return;
    }

    socket?.emit("group:message", { event_id, message });
  },

  joinDm: (connection_id: string) => {
    if (DEMO_MODE) return;
    socket?.emit("dm:join", { connection_id });
  },

  sendDmMessage: (connection_id: string, message: string) => {
    if (DEMO_MODE) {
      const me = demoCurrentUser();
      if (!me) return;

      const saved: Message = {
        id: `m-${Math.random().toString(36).slice(2, 10)}`,
        event_id: null,
        connection_id,
        sender_id: me.id,
        message,
        created_at: new Date().toISOString(),
      };

      demoAppendMessage(saved);
      emitDemoMessage(saved);
      return;
    }

    socket?.emit("dm:message", { connection_id, message });
  },

  typing: (room_id: string) => {
    if (DEMO_MODE) return;
    socket?.emit("typing", { room_id });
  },
};
