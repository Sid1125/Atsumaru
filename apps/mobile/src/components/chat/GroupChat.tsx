import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "../common/Button";
import { ScreenState } from "../common/ScreenState";
import { useMessages } from "../../features/chat/hooks/useMessages";
import {
  connectSocket,
  onServerEvent,
  onSocketStatus,
  socketActions,
  type ConnectionStatus,
} from "../../services/socket";
import { colors, radius, spacing, typography } from "../../theme";
import type { Message } from "../../types/api";

export function GroupChat({
  eventId,
  currentUserId,
}: {
  eventId: string;
  currentUserId?: string;
}) {
  const { t } = useTranslation();
  const query = useMessages(eventId);
  const [live, setLive] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    const offStatus = onSocketStatus(setStatus);
    let offMessage: (() => void) | undefined;

    connectSocket()
      .then(() => {
        socketActions.joinGroup(eventId);
        offMessage = onServerEvent("group:message", (message) => {
          if (message.event_id !== eventId) return;
          setLive((prev) =>
            prev.some((m) => m.id === message.id) ? prev : [...prev, message]
          );
        });
      })
      .catch(() => undefined);

    return () => {
      offMessage?.();
      offStatus();
    };
  }, [eventId]);

  // REST history + realtime, de-duplicated by id so reconnects don't double up.
  const messages = useMemo(() => {
    const seen = new Set<string>();
    return [...(query.data?.messages ?? []), ...live].filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [query.data?.messages, live]);

  function send() {
    const message = draft.trim();
    if (!message) return;
    socketActions.sendGroupMessage(eventId, message);
    setDraft("");
  }

  if (query.isPending) return <ScreenState status="loading" />;
  if (query.isError)
    return <ScreenState status="error" onRetry={() => query.refetch()} />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("meetup.groupChat")}</Text>
        {status !== "connected" ? (
          <Text style={styles.status}>{t("common.reconnecting")}</Text>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.sender_id === currentUserId ? styles.mine : styles.theirs,
            ]}
          >
            <Text
              style={[
                styles.text,
                item.sender_id === currentUserId && styles.mineText,
              ]}
            >
              {item.message}
            </Text>
            <Text style={styles.time}>
              {new Date(item.created_at).toLocaleTimeString()}
            </Text>
          </View>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={t("meetup.messagePlaceholder")}
          placeholder={t("meetup.messagePlaceholder")}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          style={styles.input}
        />
        <Button label={t("common.submit")} onPress={send} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, minHeight: 240 },
  header: { flexDirection: "row", justifyContent: "space-between" },
  title: { ...typography.heading, color: colors.text },
  status: { ...typography.caption, color: colors.danger },
  list: { gap: spacing.xs, paddingVertical: spacing.sm },
  bubble: { maxWidth: "85%", padding: spacing.sm, borderRadius: radius.md },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface },
  mine: { alignSelf: "flex-end", backgroundColor: colors.accent },
  text: { ...typography.body, color: colors.text },
  mineText: { color: colors.primaryText },
  time: { ...typography.caption, fontSize: 11, color: colors.textMuted },
  composer: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  input: {
    flex: 1,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
});
