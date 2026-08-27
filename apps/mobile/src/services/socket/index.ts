import { io, Socket } from "socket.io-client";

import { WS_URL } from "../../config/env";
import { getAccessToken } from "../storage/session";
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

/** One shared authenticated socket for the whole app (docs/FRONTEND.md §7). */
export async function connectSocket(): Promise<Socket> {
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
  socket?.on(event as string, handler as (...args: unknown[]) => void);
  return () => {
    socket?.off(event as string, handler as (...args: unknown[]) => void);
  };
}

export const socketActions = {
  joinGroup: (event_id: string) => socket?.emit("group:join", { event_id }),
  sendGroupMessage: (event_id: string, message: string) =>
    socket?.emit("group:message", { event_id, message }),
  joinDm: (connection_id: string) => socket?.emit("dm:join", { connection_id }),
  sendDmMessage: (connection_id: string, message: string) =>
    socket?.emit("dm:message", { connection_id, message }),
  typing: (room_id: string) => socket?.emit("typing", { room_id }),
};
