import { useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "../common/Button";
import { IconWave } from "../ui/Icons";
import { ScreenState } from "../common/ScreenState";
import { useLiveThread } from "../../features/chat/hooks/useLiveThread";
import { colors, elevation, radius, spacing, type } from "../../theme";
import type { Message } from "../../types/api";

interface ChatThreadProps {
  scope: "group" | "dm";
  id: string;
  currentUserId?: string;
  title?: string;
  /** The other participant's handle, used for the DM composer placeholder. */
  handle?: string;
  /** DMs own the whole screen; group chat sits inside the meetup scroll view. */
  fill?: boolean;
}

function Bubble({
  message,
  currentUserId,
  showSender,
}: {
  message: Message;
  currentUserId?: string;
  showSender?: boolean;
}) {
  const mine = message.sender_id === currentUserId;

  return (
    <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {showSender && !mine ? (
          <Text style={styles.sender}>{message.sender_id.slice(0, 8)}</Text>
        ) : null}
        <Text style={[styles.text, mine && styles.mineText]}>
          {message.message}
        </Text>
        <Text style={[styles.time, mine && styles.mineTime]}>
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}

/**
 * One chat surface for both group and 1:1 threads — the reusable component
 * docs/DESIGN.md §7 asks for, replacing what used to be group-only markup.
 */
export function ChatThread({
  scope,
  id,
  currentUserId,
  title,
  handle,
  fill = false,
}: ChatThreadProps) {
  const { t } = useTranslation();
  const thread = useLiveThread(scope, id);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<Message>>(null);

  // A 1:1 thread is not "your group" — address the person by handle.
  const placeholder =
    scope === "dm"
      ? t("connection.messagePlaceholder", { handle: handle ?? "" })
      : t("meetup.messagePlaceholder");

  function submit() {
    if (!draft.trim()) return;
    thread.send(draft);
    setDraft("");
  }

  if (thread.isPending) return <ScreenState status="loading" />;
  if (thread.isError)
    return <ScreenState status="error" onRetry={() => thread.refetch()} />;

  return (
    <View style={[styles.container, fill && styles.fill]}>
      {title || thread.status !== "connected" ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title ?? ""}</Text>
          {thread.status !== "connected" ? (
            <Text style={styles.status}>{t("common.reconnecting")}</Text>
          ) : null}
        </View>
      ) : null}

      {thread.messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconWave size={32} color={colors.textMuted} />
          <Text style={styles.empty}>{t("meetup.chatEmpty")}</Text>
        </View>
      ) : fill ? (
        // Full-screen DM: a virtualized list owns the scroll.
        <FlatList
          ref={listRef}
          data={thread.messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          style={styles.fill}
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
          renderItem={({ item }) => (
            <Bubble
              message={item}
              currentUserId={currentUserId}
              showSender={scope === "group"}
            />
          )}
        />
      ) : (
        /**
         * Group chat is embedded in the meetup ScrollView. A FlatList here would be a
         * VirtualizedList nested in a same-orientation ScrollView — React Native warns
         * because windowing and scroll handling both break. The group thread is
         * bounded, so plain mapped rows are the correct shape.
         */
        <View style={styles.list}>
          {thread.messages.map((item) => (
            <Bubble
              key={item.id}
              message={item}
              currentUserId={currentUserId}
              showSender={scope === "group"}
            />
          ))}
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          returnKeyType="send"
          style={styles.input}
        />
        <Button label={t("common.send")} onPress={submit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, minHeight: 220 },
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { ...type.title3, color: colors.text },
  status: { ...type.caption, color: colors.danger },
  list: { gap: spacing.sm + 2, paddingVertical: spacing.sm },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  empty: {
    ...type.footnote,
    color: colors.textMuted,
    textAlign: "center",
  },
  bubbleRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  // The squared-off corner points at the sender — the bubble is anchored to
  // where it came from rather than floating free (skill §7).
  theirs: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.xs,
    ...elevation.low,
  },
  mine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.xs,
  },
  sender: {
    ...type.overline,
    color: colors.textMuted,
    marginBottom: spacing.xxs,
  },
  text: { ...type.callout, color: colors.text },
  mineText: { color: colors.textOnColor },
  time: {
    ...type.caption,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: spacing.xxs,
    alignSelf: "flex-end",
  },
  mineTime: { color: "rgba(255,255,255,0.7)" },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: 46,
    ...type.callout,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
});
