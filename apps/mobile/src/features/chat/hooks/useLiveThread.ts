import { useEffect, useMemo, useState } from "react";
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

/**
 * REST history + realtime for one thread, shared by group chat and DMs.
 *
 * Both surfaces previously would have needed the same merge/dedupe/reconnect dance;
 * this is the one implementation of it (docs/RULES.md §3, §9 — reuse over duplicated
 * screen code). Messages are keyed by id so a reconnect replaying a message cannot
 * double it up (docs/RULES.md §10).
 */
export function useLiveThread(scope: Scope, id: string) {
  const [live, setLive] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");

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
  }, [scope, id]);

  useEffect(() => {
    const offStatus = onSocketStatus(setStatus);
    let offMessage: (() => void) | undefined;
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

            setLive((prev) =>
              prev.some((m) => m.id === message.id) ? prev : [...prev, message]
            );
          }
        );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      offMessage?.();
      offStatus();
    };
  }, [scope, id]);

  const messages = useMemo(() => {
    const seen = new Set<string>();
    return [...(query.data?.messages ?? []), ...live].filter((message) => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    });
  }, [query.data?.messages, live]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (scope === "group") socketActions.sendGroupMessage(id, trimmed);
    else socketActions.sendDmMessage(id, trimmed);
  }

  return {
    messages,
    status,
    send,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
