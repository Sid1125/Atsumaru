import { useLiveThread } from "./useLiveThread";
import { useAuthStore, useChatSeenStore } from "../../../store";
import type { Message } from "../../../types/api";

export interface ThreadPreview {
  /** The newest message, or null for an empty thread. */
  last: Message | null;
  /** True when something has arrived since this thread was last opened. */
  hasNew: boolean;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * The last message in a thread, for the "Open chat" row on the meetup screen.
 *
 * Costs **no new network call**: it reads the same
 * `["events", id, "messages"]` query `useLiveThread` already owns, and React
 * Query dedupes. `MessagePage.messages` is oldest-first (the server reverses its
 * newest-first page before returning), so the newest is simply the last element.
 *
 * Built on `useLiveThread` rather than a bare `useQuery` on purpose: the socket
 * only delivers `group:message` to sockets that have joined the room, so a
 * query-only preview would go stale the moment somebody posted while the user
 * was looking at the meetup screen. Reusing the hook keeps the row live and adds
 * no second copy of the merge/dedupe logic.
 *
 * Note this means `useLiveThread` is mounted twice for the same id while the
 * chat screen is pushed. That is benign — Socket.IO rooms are a Set so the
 * second join is a no-op, the query cache is shared, and each local tail dedupes
 * by id — and it is cheaper than inventing a subscription-counting abstraction.
 */
export function useThreadPreview(eventId: string): ThreadPreview {
  const thread = useLiveThread("group", eventId);
  const seenAt = useChatSeenStore((s) => s.seen[eventId]);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const last = thread.messages.length
    ? (thread.messages[thread.messages.length - 1] as Message)
    : null;

  // Your own message is never "new" to you.
  const hasNew =
    last !== null &&
    last.sender_id !== currentUserId &&
    (seenAt === undefined || last.created_at > seenAt);

  return {
    last,
    hasNew,
    isPending: thread.isPending,
    isError: thread.isError,
    refetch: thread.refetch,
  };
}
