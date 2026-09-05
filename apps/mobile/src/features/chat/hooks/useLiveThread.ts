import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { connectionsApi } from "../../../services/api/connections";
import { eventsApi } from "../../../services/api/events";
import {
  connectSocket,
  onServerEvent,
  onSocketStatus,
  socketActions,
  type ConnectionStatus,
} from "../../../services/socket";
import type { Message, MessagePage } from "../../../types/api";

type Scope = "group" | "dm";

/** A message this device sent that the server has not echoed back yet. */
export interface PendingMessage extends Message {
  pending: true;
}

export type ThreadMessage = Message | PendingMessage;

export function isPending(message: ThreadMessage): message is PendingMessage {
  return (message as PendingMessage).pending === true;
}

/**
 * REST history + realtime for one thread, shared by group chat and DMs.
 *
 * Messages are keyed by id so a reconnect replaying a message cannot double it
 * up (docs/RULES.md §10).
 *
 * Two things this hook does that are easy to mistake for presentation problems:
 *
 * 1. **Optimistic append.** `send()` used to emit and return, so the bubble only
 *    appeared when the server echoed it back — a real 150–600ms on mobile during
 *    which the composer had cleared and nothing had happened. That is a latency
 *    problem, and no amount of entrance animation fixes it (an animation would
 *    *add* to the wait and would start on a frame the user did not cause). The
 *    row is appended locally and reconciled on echo.
 *
 * 2. **Send errors.** The server emits `error` on every rejected send; nothing
 *    listened, so a rate-limited or over-long message vanished silently. The
 *    failed row is dropped and `sendError` is raised so the composer can restore
 *    the draft (docs/RULES.md §14 — never silently swallow an API error).
 */
export function useLiveThread(scope: Scope, id: string) {
  const [live, setLive] = useState<Message[]>([]);
  const [pendingSends, setPendingSends] = useState<PendingMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

  /**
   * The optimistic rows still awaiting an echo, readable from inside socket
   * callbacks without making them depend on render state.
   */
  const outstanding = useRef<PendingMessage[]>([]);
  outstanding.current = pendingSends;

  const query = useQuery<MessagePage>({
    queryKey:
      scope === "group"
        ? ["events", id, "messages"]
        : ["connections", id, "messages"],
    queryFn: () =>
      scope === "group" ? eventsApi.messages(id) : connectionsApi.messages(id),
  });

  // A new thread must not inherit the previous one's live tail.
  useEffect(() => {
    setLive([]);
    setPendingSends([]);
    setSendError(null);
  }, [scope, id]);

  useEffect(() => {
    const offStatus = onSocketStatus(setStatus);
    let offMessage: (() => void) | undefined;
    let offError: (() => void) | undefined;
    let cancelled = false;

    connectSocket()
      .then(() => {
        if (cancelled) return;

        if (scope === "group") socketActions.joinGroup(id);
        else socketActions.joinDm(id);

        offMessage = onServerEvent(
          scope === "group" ? "group:message" : "dm:message",
          (message) => {
            const belongs =
              scope === "group"
                ? message.event_id === id
                : message.connection_id === id;

            if (!belongs) return;

            /**
             * Reconcile against our own optimistic row. The id is server-assigned,
             * so it cannot match; we match on sender + exact text instead and drop
             * the oldest such pending row. This is deliberately the interim
             * approach — threading a `client_id` through the socket payload would
             * make this an id comparison, and is logged as a follow-up.
             */
            setPendingSends((prev) => {
              const index = prev.findIndex(
                (p) =>
                  p.sender_id === message.sender_id &&
                  p.message === message.message
              );
              return index === -1
                ? prev
                : [...prev.slice(0, index), ...prev.slice(index + 1)];
            });

            setLive((prev) =>
              prev.some((m) => m.id === message.id) ? prev : [...prev, message]
            );
          }
        );

        offError = onServerEvent("error", (payload) => {
          const belongs =
            scope === "group"
              ? payload.event_id === id
              : payload.connection_id === id;

          if (!belongs) return;

          // The send did not land, so its optimistic row must not linger as if
          // it had. Drop the oldest outstanding one and surface the reason.
          setPendingSends((prev) => prev.slice(1));
          setSendError(payload.code);
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      offMessage?.();
      offError?.();
      offStatus();
    };
  }, [scope, id]);

  const messages = useMemo<ThreadMessage[]>(() => {
    const seen = new Set<string>();
    const settled = [...(query.data?.messages ?? []), ...live].filter(
      (message) => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
      }
    );

    // Pending rows always sit at the bottom — they are the newest by definition.
    return [...settled, ...pendingSends];
  }, [query.data?.messages, live, pendingSends]);

  const clearSendError = useCallback(() => setSendError(null), []);

  /**
   * Returns the trimmed text it sent (or `null` for an empty draft) so the caller
   * can restore the composer if the send is later rejected.
   */
  const send = useCallback(
    (text: string, senderId?: string): string | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;

      setSendError(null);

      if (senderId) {
        setPendingSends((prev) => [
          ...prev,
          {
            // Local-only id; replaced by the server's row on echo.
            id: `pending-${Date.now()}-${prev.length}`,
            event_id: scope === "group" ? id : null,
            connection_id: scope === "dm" ? id : null,
            sender_id: senderId,
            message: trimmed,
            created_at: new Date().toISOString(),
            pending: true,
          },
        ]);
      }

      if (scope === "group") socketActions.sendGroupMessage(id, trimmed);
      else socketActions.sendDmMessage(id, trimmed);

      return trimmed;
    },
    [scope, id]
  );

  return {
    messages,
    status,
    send,
    sendError,
    clearSendError,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
