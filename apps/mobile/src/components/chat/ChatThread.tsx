import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn } from "react-native-reanimated";

import { IconSend, IconWave } from "../ui/Icons";
import { PressableScale } from "../ui/PressableScale";
import { ScreenState } from "../common/ScreenState";
import {
  isPending as isPendingMessage,
  useLiveThread,
  type ThreadMessage,
} from "../../features/chat/hooks/useLiveThread";
import {
  colors,
  elevation,
  MIN_TARGET,
  radius,
  spacing,
  timings,
  type,
  useReducedMotion,
} from "../../theme";

/** How close to the bottom counts as "pinned" for auto-scroll purposes. */
const PINNED_THRESHOLD = 40;

/** How long a disconnect must persist before it is worth telling the user. */
const RECONNECT_NOTICE_DELAY = 600;

interface ChatThreadProps {
  scope: "group" | "dm";
  id: string;
  currentUserId?: string;
  /** The other participant's handle, used for the DM composer placeholder. */
  handle?: string;
  /**
   * user_id → handle, for group threads. Sender labels are pseudonymous
   * handles, never raw ids.
   */
  members?: Record<string, string>;
}

function Bubble({
  message,
  currentUserId,
  showSender,
  senderHandle,
  animate,
}: {
  message: ThreadMessage;
  currentUserId?: string;
  showSender?: boolean;
  senderHandle?: string;
  animate: boolean;
}) {
  const { t } = useTranslation();
  const mine = message.sender_id === currentUserId;
  const pending = isPendingMessage(message);

  return (
    <Animated.View
      /**
       * Only *incoming* messages fade in, and only opacity.
       *
       * Your own message is instant: sending is a high-frequency action you just
       * caused, so the bubble IS the feedback and any delay is friction. A
       * translateY would also fight `scrollToEnd` at the bottom of the list and
       * read as jitter rather than arrival.
       */
      entering={animate && !mine ? FadeIn.duration(timings.fast.duration) : undefined}
      style={[styles.bubbleRow, mine && styles.bubbleRowMine]}
    >
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {showSender && !mine ? (
          <Text style={styles.sender}>
            {senderHandle ? `@${senderHandle}` : message.sender_id.slice(0, 8)}
          </Text>
        ) : null}
        <Text style={[styles.text, mine && styles.mineText]}>
          {message.message}
        </Text>
        {/* The pending state is a word, not a spinner and not a colour —
            it must survive both reduced motion and colour blindness. */}
        <Text style={[styles.time, mine && styles.mineTime]}>
          {pending
            ? t("common.sending")
            : new Date(message.created_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
        </Text>
      </View>
    </Animated.View>
  );
}

/**
 * The one chat surface, for both group and 1:1 threads.
 *
 * It renders full-screen, always. It used to carry a `fill` prop that switched
 * between a virtualized `FlatList` and plain mapped rows, and that switch *was*
 * the bug: only the `fill` branch virtualized, auto-scrolled and pinned the
 * composer, so the meetup screen — which omitted the prop — got an uncapped,
 * non-scrolling thread with its composer below the entire history. `fill` was an
 * opt-*in* to correct behaviour, which meant a caller could select the broken
 * configuration by forgetting a prop. Both call sites are now full-screen and
 * the branch is gone.
 */
export function ChatThread({
  scope,
  id,
  currentUserId,
  handle,
  members,
}: ChatThreadProps) {
  const { t } = useTranslation();
  const thread = useLiveThread(scope, id);
  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ThreadMessage>>(null);

  /** Whether the user is reading the newest messages or scrolled up in history. */
  const pinnedToBottom = useRef(true);
  const previousCount = useRef(0);

  // A 1:1 thread is not "your group" — address the person by handle.
  const placeholder =
    scope === "dm"
      ? t("connection.messagePlaceholder", { handle: handle ?? "" })
      : t("meetup.messagePlaceholder");

  /**
   * A rejected send restores the draft so the text is not lost, and says why.
   * `RATE_LIMITED` gets its own line because "try again" is wrong advice for it.
   */
  useEffect(() => {
    if (!thread.sendError) return;
    setDraft((current) => current || lastAttempt.current);
  }, [thread.sendError]);

  const lastAttempt = useRef("");

  const submit = useCallback(() => {
    const sent = thread.send(draft, currentUserId);
    if (sent === null) return;

    lastAttempt.current = sent;
    setDraft("");
    // You caused this one, so it should already be at the bottom — no animation.
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [thread, draft, currentUserId]);

  /**
   * Auto-scroll rules. Moving someone's reading position while they are scrolled
   * up in history is the worst thing this list can do, so it only follows the
   * newest message when the user was already at the bottom.
   */
  useEffect(() => {
    const count = thread.messages.length;
    if (count === previousCount.current) return;

    const grew = count > previousCount.current;
    previousCount.current = count;

    if (!grew || !pinnedToBottom.current) return;

    listRef.current?.scrollToEnd({ animated: !reducedMotion });
  }, [thread.messages.length, reducedMotion]);

  const canSend = draft.trim().length > 0;

  return (
    <View style={styles.container}>
      <ReconnectingNotice status={thread.status} />

      {/**
       * The list scaffold and the composer render in every state, including
       * loading and error. Replacing the whole surface with a ScreenState —
       * which is what this component used to do — took the composer away too, so
       * a failed history fetch removed the ability to send a message at all.
       */}
      <FlatList
        ref={listRef}
        data={thread.messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          thread.messages.length === 0 && styles.listEmpty,
        ]}
        style={styles.fill}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } =
            event.nativeEvent;
          pinnedToBottom.current =
            contentSize.height - contentOffset.y - layoutMeasurement.height <
            PINNED_THRESHOLD;
        }}
        scrollEventThrottle={16}
        ListEmptyComponent={
          thread.isPending ? (
            <ScreenState status="loading" />
          ) : thread.isError ? (
            <ScreenState status="error" onRetry={() => thread.refetch()} />
          ) : (
            <View style={styles.emptyContainer}>
              <IconWave size={32} color={colors.textMuted} />
              <Text style={styles.empty}>{t("meetup.chatEmpty")}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Bubble
            message={item}
            currentUserId={currentUserId}
            showSender={scope === "group"}
            senderHandle={scope === "group" ? members?.[item.sender_id] : undefined}
            animate={!reducedMotion}
          />
        )}
      />

      {thread.sendError ? (
        <Text style={styles.sendError} accessibilityLiveRegion="polite">
          {thread.sendError === "RATE_LIMITED"
            ? t("common.rateLimited")
            : t("common.sendFailed")}
        </Text>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          accessibilityLabel={placeholder}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            if (thread.sendError) thread.clearSendError();
          }}
          onSubmitEditing={submit}
          returnKeyType="send"
          // Mirrors the server's own cap, so an over-long message is stopped at
          // the keyboard rather than rejected after a round trip.
          maxLength={2000}
          multiline
          style={styles.input}
        />
        <PressableScale
          accessibilityLabel={t("common.send")}
          onPress={submit}
          disabled={!canSend}
          // Sending is a high-frequency action; a buzz on every message is not
          // "haptics sparingly" (docs/DESIGN.md §9). It was also inconsistent —
          // the return key bypasses this button entirely.
          haptic="none"
          scaleTo={0.9}
          style={[styles.send, !canSend && styles.sendDisabled]}
        >
          <IconSend
            size={20}
            color={canSend ? colors.primaryText : colors.textMuted}
          />
        </PressableScale>
      </View>
    </View>
  );
}

/**
 * A flaky connection flips status repeatedly, and an instantly-appearing label
 * strobes — hostile as a live region, and noise the user cannot act on. So the
 * notice waits for the disconnect to persist, then appears immediately (never
 * delay a failure notice once it is real).
 */
function ReconnectingNotice({ status }: { status: string }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "connected") {
      setVisible(false);
      return;
    }

    const timer = setTimeout(() => setVisible(true), RECONNECT_NOTICE_DELAY);
    return () => clearTimeout(timer);
  }, [status]);

  if (!visible) return null;

  return (
    <Text style={styles.status} accessibilityLiveRegion="polite">
      {t("common.reconnecting")}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.sm },
  fill: { flex: 1 },
  status: {
    ...type.caption,
    color: colors.danger,
    textAlign: "center",
    paddingVertical: spacing.xs,
  },
  list: { gap: spacing.sm + 2, paddingVertical: spacing.sm },
  listEmpty: { flexGrow: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  empty: { ...type.footnote, color: colors.textMuted, textAlign: "center" },
  bubbleRow: { flexDirection: "row", justifyContent: "flex-start" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  // The squared-off corner points at the sender — the bubble is anchored to
  // where it came from rather than floating free.
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
    color: colors.textMuted,
    marginTop: spacing.xxs,
    alignSelf: "flex-end",
  },
  mineTime: { color: colors.nightMuted },
  sendError: {
    ...type.footnote,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
  },
  composer: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    minHeight: MIN_TARGET,
    maxHeight: 120,
    ...type.callout,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 2,
    color: colors.text,
  },
  send: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  // Disabled reads as colour, never opacity — PressableScale owns opacity.
  sendDisabled: { backgroundColor: colors.backgroundElevated },
});
