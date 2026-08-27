import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colors, radius, spacing, typography } from "../../theme";
import type { MeetupEvent } from "../../types/api";

interface EventCardProps {
  event: MeetupEvent;
  matchScore?: number;
  onPress: () => void;
}

export function EventCard({ event, matchScore, onPress }: EventCardProps) {
  const { t, i18n } = useTranslation();

  const when = new Date(event.start_time).toLocaleString(i18n.language, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${event.venue_name}, ${when}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.meta}>
        {event.venue_name} · {when}
      </Text>
      <View style={styles.row}>
        <Text style={styles.meta}>
          {t("discover.size", {
            current: event.current_size,
            max: event.max_size,
          })}
        </Text>
        {matchScore != null ? (
          <Text style={styles.score}>
            {t("discover.groupFit", { score: Math.round(matchScore * 100) })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.9 },
  title: { ...typography.heading, color: colors.text },
  meta: { ...typography.caption, color: colors.textMuted },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
  },
  score: { ...typography.caption, color: colors.accent, fontWeight: "600" },
});
