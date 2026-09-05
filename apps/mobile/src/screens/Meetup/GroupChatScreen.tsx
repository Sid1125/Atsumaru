import { useCallback, useLayoutEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { RouteProp } from "@react-navigation/native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import { Avatar } from "../../components/common/Avatar";
import { ChatScreenShell } from "../../components/chat/ChatScreenShell";
import { ChatThread } from "../../components/chat/ChatThread";
import { ScreenState } from "../../components/common/ScreenState";
import {
  useEvent,
  useEventMembers,
} from "../../features/events/hooks/useEvents";
import { useAuthStore, useChatSeenStore } from "../../store";
import { useThreadPreview } from "../../features/chat/hooks/useThreadPreview";
import { colors, radius, spacing } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";

/** How many faces fit before the stack stops being legible. */
const MAX_FACES = 4;

/**
 * The group thread, as its own destination.
 *
 * It used to live inside `MeetupScreen`'s ScrollView as child #8, roughly 780pt
 * down a ~740pt viewport — below the fold before a single message was read, with
 * its composer beneath the entire history and no keyboard handling at all.
 * `docs/DESIGN.md` §5 always specified a short preview plus an "Open chat" CTA
 * rather than an embedded thread, so this is a correction back to spec.
 *
 * Both queries below are normally already warm: `MeetupScreen` fetched them, and
 * the chat row prefetches the message history on press-down, so the push
 * typically lands on content rather than a spinner.
 */
export function GroupChatScreen() {
  const { t } = useTranslation();
  const { eventId, title } =
    useRoute<RouteProp<AppStackParamList, "GroupChat">>().params;
  const navigation = useNavigation();
  const currentUser = useAuthStore((s) => s.user);

  const eventQuery = useEvent(eventId);
  const membersQuery = useEventMembers(eventId);

  /**
   * Mark the thread seen when the screen loses focus rather than when it gains
   * it: marking on focus would clear the badge for messages that arrive while
   * the user is sitting in the thread, which is exactly when they have in fact
   * seen them — but it would also clear it on a screen that never rendered them
   * (a cold deep link that errors). Marking on the way out is the honest moment.
   */
  const preview = useThreadPreview(eventId);
  const markSeen = useChatSeenStore((s) => s.markSeen);
  const newest = preview.last?.created_at;

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (newest) markSeen(eventId, newest);
      };
    }, [eventId, newest, markSeen])
  );

  const members = membersQuery.data?.members ?? [];

  /**
   * The destination repeats the identity the origin row showed — same title,
   * same faces. Shared-element transitions are unavailable in this stack (the
   * Reanimated feature flag is off at build time), so this repetition is what
   * carries the continuity instead.
   */
  const faces = useMemo(() => members.slice(0, MAX_FACES), [members]);
  const overflow = Math.max(0, members.length - MAX_FACES);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: title ?? eventQuery.data?.event.title ?? t("meetup.groupChat"),
      headerRight: () =>
        faces.length === 0 ? null : (
          <View
            style={styles.faces}
            accessibilityLabel={t("discover.size", {
              current: members.length,
              max: eventQuery.data?.event.max_size ?? members.length,
            })}
          >
            {faces.map((member, index) => (
              <View
                key={member.id}
                style={[styles.face, index > 0 && styles.faceOverlap]}
              >
                <Avatar
                  id={member.user.handle}
                  label={member.user.handle}
                  uri={member.user.avatar_url}
                  size="sm"
                />
              </View>
            ))}
            {overflow > 0 ? (
              <View style={[styles.face, styles.faceOverlap, styles.overflow]} />
            ) : null}
          </View>
        ),
    });
  }, [
    navigation,
    title,
    eventQuery.data?.event.title,
    eventQuery.data?.event.max_size,
    faces,
    overflow,
    members.length,
    t,
  ]);

  /**
   * A deep link can land here without passing through the meetup screen, and the
   * server enforces membership on both REST and socket. A non-member must see
   * that plainly rather than an empty thread that silently never sends.
   */
  if (membersQuery.isError) {
    return (
      <ScreenState status="error" onRetry={() => membersQuery.refetch()} />
    );
  }

  return (
    <ChatScreenShell>
      <ChatThread
        scope="group"
        id={eventId}
        currentUserId={currentUser?.id}
        members={Object.fromEntries(
          members.map((m) => [m.user_id, m.user.handle])
        )}
      />
    </ChatScreenShell>
  );
}

const styles = StyleSheet.create({
  faces: { flexDirection: "row", alignItems: "center", paddingRight: spacing.xs },
  face: {
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.background,
  },
  faceOverlap: { marginLeft: -spacing.sm - 2 },
  overflow: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundElevated,
  },
});
