import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import { Card } from "../ui/Card";
import { IconChevronRight } from "../ui/Icons";
import { PressableScale } from "../ui/PressableScale";
import { Tape } from "../ui/Tape";
import { useThreadPreview } from "../../features/chat/hooks/useThreadPreview";
import { eventsApi } from "../../services/api/events";
import { useAuthStore } from "../../store";
import { colors, radius, spacing, type } from "../../theme";

interface GroupChatCardProps {
  eventId: string;
  /** handle lookup for the preview line's sender. */
  members: Record<string, string>;
  onPress: () => void;
}

/**
 * The door to the group thread, sitting directly under the hero.
 *
 * This replaces an embedded live thread that began ~780pt down the meetup
 * screen. `docs/DESIGN.md` §5 always specified this shape — a short preview plus
 * an "Open chat" CTA — and `meetup.openChat` has been sitting unused in all
 * three locales since.
 *
 * A preview row rather than a plain button, for two reasons: a bare button would
 * sit beside "Leave group" and create the destructive-next-to-primary adjacency
 * DESIGN §9 warns about, and it would answer nothing. The last message *is* the
 * reason to tap.
 */
export function GroupChatCard({ eventId, members, onPress }: GroupChatCardProps) {
  const { t } = useTranslation();
  const preview = useThreadPreview(eventId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  /**
   * Warm the thread on press-*down*, ~100-150ms before `navigate()` runs. That
   * head start is often the whole difference between the chat screen mounting
   * with content and mounting on a spinner — and since shared-element
   * transitions are unavailable in this stack, landing on real content is what
   * carries the continuity.
   */
  const prefetch = useCallback(() => {
    void queryClient.prefetchQuery({
      queryKey: ["events", eventId, "messages"],
      queryFn: () => eventsApi.messages(eventId),
    });
  }, [queryClient, eventId]);

  const sender = preview.last
    ? preview.last.sender_id === currentUserId
      ? t("common.you")
      : `@${members[preview.last.sender_id] ?? ""}`
    : null;

  return (
    <PressableScale
      accessibilityLabel={t("meetup.openChat")}
      onPress={onPress}
      onPressIn={prefetch}
      // A large surface moves less under the finger than a small one.
      scaleTo={0.98}
      // The transition is the feedback here; a buzz on every navigation is not
      // "haptics sparingly" (DESIGN §9).
      haptic="none"
    >
      <Card style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.kicker}>{t("meetup.groupChat")}</Text>
          {/* Colour is paired with a word, never carrying the state alone. */}
          {preview.hasNew ? (
            <Tape label={t("meetup.chatNew")} tone="action" rotate={-1} />
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.line}>
            <PreviewLine
              isPending={preview.isPending}
              isError={preview.isError}
              text={
                preview.last && sender
                  ? `${sender}: ${preview.last.message}`
                  : null
              }
            />
          </View>
          <View style={styles.chevron}>
            <IconChevronRight size={18} color={colors.textMuted} />
          </View>
        </View>
      </Card>
    </PressableScale>
  );
}

/**
 * Loading and error are one muted line, deliberately — not `ScreenState`. A
 * 200pt centred block dropped into the middle of a scrolling page is the disease
 * this whole change is curing.
 */
function PreviewLine({
  isPending,
  isError,
  text,
}: {
  isPending: boolean;
  isError: boolean;
  text: string | null;
}) {
  const { t } = useTranslation();

  if (isPending) {
    return <Text style={styles.muted}>{t("common.loading")}</Text>;
  }

  if (isError) {
    return (
      <Text style={styles.error} accessibilityLiveRegion="polite">
        {t("common.error")}
      </Text>
    );
  }

  if (!text) {
    // An empty thread is an invitation, not a dead end.
    return <Text style={styles.muted}>{t("meetup.chatEmpty")}</Text>;
  }

  return (
    <Text style={styles.preview} numberOfLines={1}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: { ...type.overline, color: colors.textMuted },
  body: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  line: { flex: 1 },
  preview: { ...type.callout, color: colors.text },
  muted: { ...type.footnote, color: colors.textMuted },
  error: { ...type.footnote, color: colors.danger },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
});
