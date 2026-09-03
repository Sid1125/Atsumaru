/**
 * Who is currently connected.
 *
 * Split out of `socket/index.ts` so the chat notice can ask about presence without the
 * socket layer having to import it back — `socket/index.ts` triggers the notice, the notice
 * reads presence, and nothing imports in a circle.
 *
 * Presence is derived from the `user:{id}` room every socket joins on connect, so it needs
 * no schema, no heartbeat and no cleanup.
 */

import type { Server } from "socket.io";

let io: Server | null = null;

/** Called once by `attachSocket`; presence is a no-op until then. */
export function setPresenceServer(server: Server | null) {
  io = server;
}

/**
 * Which of these members have a live socket right now.
 *
 * Used to decide who needs a chat notification: someone with the thread open already
 * received the message over the socket, and pushing to them as well is exactly what makes
 * a chat app feel broken.
 *
 * **Single instance only.** `fetchSockets()` sees the sockets attached to *this* process,
 * so with more than one API instance behind a load balancer a member connected to another
 * instance reads as offline here and would get a redundant push. The fix is the Socket.io
 * Redis adapter behind the existing `REDIS_URL` flag, the same way the job queue already
 * degrades — a named follow-up, not something this code pretends to have solved.
 *
 * Fails toward notifying: no socket layer means nobody can be proven online, so the caller
 * pushes. A redundant notification is a smaller failure than a thread that stays silent.
 */
export async function onlineUserIds(userIds: string[]): Promise<Set<string>> {
  const online = new Set<string>();
  const server = io;

  if (!server || userIds.length === 0) return online;

  await Promise.all(
    userIds.map(async (userId) => {
      try {
        const sockets = await server.in(`user:${userId}`).fetchSockets();
        if (sockets.length > 0) online.add(userId);
      } catch {
        // Treated as offline, per the bias above.
      }
    })
  );

  return online;
}
