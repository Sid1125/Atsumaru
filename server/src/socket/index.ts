import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";

import { env } from "../config/env.js";
import { verifySocketToken } from "../middleware/auth.js";

interface SocketData {
  userId: string;
}

/** Rooms: group:{event_id} and dm:{connection_id} (docs/API_STRUCTURE.md §4). */
export function attachSocket(httpServer: HttpServer) {
  const io = new Server<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>(
    httpServer,
    { cors: { origin: env.CORS_ORIGIN } }
  );

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
    // TODO: check membership before joining a room, and persist messages before
    // broadcasting so the REST history and realtime stream agree.
    socket.on("group:join", ({ event_id }: { event_id: string }) => {
      socket.join(`group:${event_id}`);
      socket.to(`group:${event_id}`).emit("member:joined", {
        event_id,
        user_id: socket.data.userId,
      });
    });

    socket.on(
      "group:message",
      ({ event_id, message }: { event_id: string; message: string }) => {
        io.to(`group:${event_id}`).emit("group:message", {
          id: crypto.randomUUID(),
          event_id,
          sender_id: socket.data.userId,
          message,
          created_at: new Date().toISOString(),
        });
      }
    );

    socket.on("dm:join", ({ connection_id }: { connection_id: string }) => {
      socket.join(`dm:${connection_id}`);
    });

    socket.on(
      "dm:message",
      ({ connection_id, message }: { connection_id: string; message: string }) => {
        io.to(`dm:${connection_id}`).emit("dm:message", {
          id: crypto.randomUUID(),
          event_id: connection_id,
          sender_id: socket.data.userId,
          message,
          created_at: new Date().toISOString(),
        });
      }
    );

    socket.on("typing", ({ room_id }: { room_id: string }) => {
      socket.to(room_id).emit("typing", {
        room_id,
        user_id: socket.data.userId,
      });
    });
  });

  return io;
}
