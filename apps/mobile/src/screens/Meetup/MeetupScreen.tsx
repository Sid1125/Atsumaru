import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "../../components/common/Button";
import { Chip } from "../../components/common/Chip";
import { ScreenState } from "../../components/common/ScreenState";
import { GroupChat } from "../../components/chat/GroupChat";
import { FeedbackPanel } from "../../components/feedback/FeedbackPanel";
import {
  useEvent,
  useEventMembers,
  useMatchPreview,
} from "../../features/events/hooks/useEvents";
import { eventsApi } from "../../services/api/events";
import { useAuthStore } from "../../store";
import { colors, spacing, typography } from "../../theme";
import type { AppStackParamList } from "../../app/navigation/types";

export function MeetupScreen() {
  const { t } = useTranslation();
  const { eventId } = useRoute<RouteProp<AppStackParamList, "Meetup">>().params;
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const eventQuery = useEvent(eventId);
  const membersQuery = useEventMembers(eventId);
  const matchQuery = useMatchPreview(eventId);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const members = membersQuery.data?.members ?? [];
  const isMember = members.some((m) => m.user_id === currentUser?.id);

  async function toggleMembership() {
    setJoining(true);
    setJoinError(null);

    try {
      if (isMember) {
        await eventsApi.leave(eventId);
      } else {
        await eventsApi.join(eventId);
      }
      await queryClient.invalidateQueries({ queryKey: ["events", eventId] });
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.meta}>
        {event.venue_name} · {new Date(event.start_time).toLocaleString()}
      </Text>

      <Text style={styles.section}>
        {t("meetup.yourGroup")} ·{" "}
        {t("discover.size", {
          current: event.current_size,
          max: event.max_size,
        })}
      </Text>
      <View style={styles.chips}>
        {members.map((member) => (
          <Chip key={member.id} label={`@${member.user.handle}`} />
        ))}
      </View>

      {matchQuery.data ? (
        <>
          <Text style={styles.score}>
            {t("discover.groupFit", {
              score: Math.round(matchQuery.data.match_score * 100),
            })}
          </Text>
          <Text style={styles.section}>{t("meetup.whyThisGroup")}</Text>
          {matchQuery.data.why.map((reason) => (
            <Text key={reason} style={styles.meta}>
              • {reason}
            </Text>
          ))}
        </>
      ) : null}

      {joinError ? <Text style={styles.error}>{joinError}</Text> : null}

      <Button
        label={isMember ? t("meetup.leave") : t("meetup.join")}
        variant={isMember ? "secondary" : "primary"}
        onPress={toggleMembership}
        loading={joining}
      />

      {isMember && !isCompleted ? (
        <GroupChat eventId={eventId} currentUserId={currentUser?.id} />
      ) : null}

      {isMember && isCompleted ? <FeedbackPanel eventId={eventId} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm },
  title: { ...typography.title, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  section: { ...typography.heading, color: colors.text, marginTop: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  score: { ...typography.heading, color: colors.accent, marginTop: spacing.md },
  error: { ...typography.caption, color: colors.danger },
});
