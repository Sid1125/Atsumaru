import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { Button } from "../../components/common/Button";
import { ScreenState } from "../../components/common/ScreenState";
import { ChatThread } from "../../components/chat/ChatThread";
import { FeedbackPanel } from "../../components/feedback/FeedbackPanel";
import {
  useEvent,
  useEventMembers,
  useMatchPreview,
} from "../../features/events/hooks/useEvents";
import { eventsApi } from "../../services/api/events";
import { onServerEvent } from "../../services/socket";
import { useAuthStore } from "../../store";
import {
  colors,
  elevation,
  radius,
  sectionHeader,
  spacing,
  springs,
  type,
  useReducedMotion,
} from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";
import type { Connection, GroupMember } from "../../types/api";

type Nav = NativeStackNavigationProp<AppStackParamList, "Meetup">;

const CATEGORY_GLYPH: Record<string, string> = {
  food: "🍜",
  gaming: "🎮",
  arts: "🎨",
  outdoor: "🥾",
};

function MemberAvatar({ member }: { member: GroupMember }) {
  return (
    <View style={styles.member}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberInitial}>
          {member.user.handle.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.memberHandle} numberOfLines={1}>
        @{member.user.handle}
      </Text>
    </View>
  );
}

export function MeetupScreen() {
  const { t } = useTranslation();
  const { eventId } = useRoute<RouteProp<AppStackParamList, "Meetup">>().params;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  const eventQuery = useEvent(eventId);
  const membersQuery = useEventMembers(eventId);
  const matchQuery = useMatchPreview(eventId);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<Connection | null>(null);

  const members = membersQuery.data?.members ?? [];
  const isMember = members.some((m) => m.user_id === currentUser?.id);

  useEffect(() => {
    const off = onServerEvent("match:unlocked", (connection) => {
      setUnlocked(connection);
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
    });

    return off;
  }, [queryClient]);

  async function toggleMembership() {
    setJoining(true);
    setJoinError(null);

    try {
      if (isMember) await eventsApi.leave(eventId);
      else await eventsApi.join(eventId);

      await queryClient.invalidateQueries({ queryKey: ["events"] });
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setJoining(false);
    }
  }

  if (eventQuery.isPending) return <ScreenState status="loading" />;
  if (eventQuery.isError)
    return <ScreenState status="error" onRetry={() => eventQuery.refetch()} />;

  const event = eventQuery.data.event;
  const isCompleted = event.status === "completed";
  const score = matchQuery.data
    ? Math.round(matchQuery.data.match_score * 100)
    : null;

  function openConnection(connection: Connection) {
    const otherId =
      connection.user_a === currentUser?.id ? connection.user_b : connection.user_a;
    const other = members.find((m) => m.user_id === otherId);

    navigation.navigate("Dm", {
      connectionId: connection.id,
      handle: other?.user.handle,
    });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 52, paddingBottom: insets.bottom + spacing.xxl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero — category glyph anchors the meetup's identity */}
      <View style={styles.hero}>
        <View style={styles.heroGlyph}>
          <Text style={styles.heroGlyphText}>
            {CATEGORY_GLYPH[event.category] ?? "📍"}
          </Text>
        </View>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.meta}>
          {event.venue_name} ·{" "}
          {new Date(event.start_time).toLocaleString(undefined, {
            weekday: "long",
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
        {event.description ? (
          <Text style={styles.description}>{event.description}</Text>
        ) : null}
      </View>

      {/* Match — the AI's answer, stated plainly with its reasons */}
      {score != null ? (
        <View style={styles.matchCard}>
          <View style={styles.matchHead}>
            <Text style={styles.matchScore}>{score}%</Text>
            <Text style={styles.matchLabel}>{t("meetup.groupFitLabel")}</Text>
          </View>
          <View style={styles.matchReasons}>
            {matchQuery.data!.why.map((reason) => (
              <View key={reason} style={styles.reasonRow}>
                <Text style={styles.reasonBullet}>•</Text>
                <Text style={styles.reasonText}>{reason}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Group */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>
          {t("meetup.yourGroup")} ·{" "}
          {t("discover.size", {
            current: event.current_size,
            max: event.max_size,
          })}
        </Text>
        <View style={styles.members}>
          {members.map((member) => (
            <MemberAvatar key={member.id} member={member} />
          ))}
        </View>
      </View>

      {joinError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {joinError}
        </Text>
      ) : null}

      {!isCompleted ? (
        <Button
          label={isMember ? t("meetup.leave") : t("meetup.join")}
          variant={isMember ? "secondary" : "primary"}
          onPress={toggleMembership}
          loading={joining}
          size="large"
        />
      ) : null}

      {/* The emotional payoff — the one place extra life is earned (skill §4) */}
      {unlocked ? (
        <Animated.View
          entering={reducedMotion ? undefined : ZoomIn.springify().damping(9)}
          style={styles.celebration}
        >
          <Text style={styles.celebrationGlyph}>🎉</Text>
          <Text style={styles.celebrationTitle}>
            {t("connection.mutualTitle")}
          </Text>
          <Button
            label={t("connection.startChatting")}
            onPress={() => openConnection(unlocked)}
            haptic="success"
          />
        </Animated.View>
      ) : null}

      {isMember && !isCompleted ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(280)}
          style={styles.section}
        >
          <Text style={styles.sectionHeader}>{t("meetup.groupChat")}</Text>
          <ChatThread
            scope="group"
            id={eventId}
            currentUserId={currentUser?.id}
          />
        </Animated.View>
      ) : null}

      {isMember && isCompleted ? (
        <FeedbackPanel eventId={eventId} onOpenConnection={openConnection} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.md, gap: spacing.lg },

  hero: { gap: spacing.xs },
  heroGlyph: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  heroGlyphText: { fontSize: 30 },
  title: { ...type.display, color: colors.text },
  meta: { ...type.subhead, color: colors.textMuted },
  description: { ...type.body, color: colors.textSecondary, marginTop: spacing.sm },

  matchCard: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  matchHead: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  matchScore: { ...type.display, color: colors.accent },
  matchLabel: { ...type.subhead, color: colors.accent, flex: 1 },
  matchReasons: { gap: spacing.xs },
  reasonRow: { flexDirection: "row", gap: spacing.sm },
  reasonBullet: { ...type.footnote, color: colors.accent },
  reasonText: { ...type.footnote, color: colors.textSecondary, flex: 1 },

  section: { gap: spacing.sm },
  sectionHeader: { ...sectionHeader, color: colors.textMuted },
  members: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  member: { alignItems: "center", gap: spacing.xs, width: 62 },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  memberInitial: { ...type.title3, color: colors.textOnColor },
  memberHandle: { ...type.caption, color: colors.textMuted },

  error: { ...type.footnote, color: colors.danger },

  celebration: {
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
    ...elevation.medium,
  },
  celebrationGlyph: { fontSize: 40 },
  celebrationTitle: {
    ...type.title3,
    color: colors.text,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
});
