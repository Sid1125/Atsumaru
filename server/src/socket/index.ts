import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import { env } from "../config/env.js";
import { verifySocketToken } from "../middleware/auth.js";
import {
  insertMessage,
  publicUser,
  requireConnection,
  requireMembership,
} from "../db/queries.js";

interface SocketData {
  userId: string;
}

/** Event names are documented in docs/API_STRUCTURE.md §4; payloads stay loose. */
type Events = Record<string, (payload: any) => void>;

type AppServer = Server<Events, Events, Events, SocketData>;

let server: AppServer | null = null;

/** Rooms: group:{event_id}, dm:{connection_id}, user:{user_id} (docs/API_STRUCTURE.md §4). */
export function attachSocket(httpServer: HttpServer) {
  const io: AppServer = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN },
  });

  server = io;

  io.use(async (socket, next) => {
    try {
      socket.data.userId = await verifySocketToken(
        socket.handshake.auth?.token as string | undefined
      );
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;

    // Personal room for direct server pushes such as match:unlocked.
    socket.join(`user:${userId}`);

    socket.on("group:join", async ({ event_id }: { event_id: string }) => {
      try {
        await requireMembership(event_id, userId);
      } catch {
        socket.emit("error", { code: "NOT_A_MEMBER", event_id });
        return;
      }

      // The contract's payload is the expanded public user (docs/API_STRUCTURE.md §4).
      let user;

      try {
        user = await publicUser(userId);
      } catch {
        socket.emit("error", { code: "JOIN_FAILED", event_id });
        return;
      }

      socket.join(`group:${event_id}`);
      socket.to(`group:${event_id}`).emit("member:joined", { event_id, user });
    });

    // Persist before broadcasting so REST history and the live stream agree.
    socket.on(
      "group:message",
      async ({ event_id, message }: { event_id: string; message: string }) => {
        if (typeof message !== "string" || message.length < 1 || message.length > 2000) {
          socket.emit("error", { code: "INVALID_MESSAGE", event_id });
          return;
        }

        try {
          await requireMembership(event_id, userId);
          const saved = await insertMessage("event_id", event_id, userId, message);
          io.to(`group:${event_id}`).emit("group:message", saved);
        } catch {
          socket.emit("error", { code: "SEND_FAILED", event_id });
        }
      }
    );

    socket.on("dm:join", async ({ connection_id }: { connection_id: string }) => {
      try {
        await requireConnection(connection_id, userId);
      } catch {
        socket.emit("error", { code: "NO_CONNECTION", connection_id });
        return;
      }

      socket.join(`dm:${connection_id}`);
    });

    socket.on(
      "dm:message",
      async ({ connection_id, message }: { connection_id: string; message: string }) => {
        if (typeof message !== "string" || message.length < 1 || message.length > 2000) {
          socket.emit("error", { code: "INVALID_MESSAGE", connection_id });
          return;
        }

        try {
          await requireConnection(connection_id, userId);
          const saved = await insertMessage(
            "connection_id",
            connection_id,
            userId,
            message
          );
          io.to(`dm:${connection_id}`).emit("dm:message", saved);
        } catch {
          socket.emit("error", { code: "SEND_FAILED", connection_id });
        }
      }
    );

    socket.on("typing", ({ room_id }: { room_id: string }) => {
      socket.to(room_id).emit("typing", { room_id, user_id: userId });
    });
  });

  return io;
}

/** Fire-and-forget push to one user; a no-op when the socket layer is not up. */
export function emitToUser(userId: string, event: string, payload: unknown) {
  server?.to(`user:${userId}`).emit(event, payload);
}
