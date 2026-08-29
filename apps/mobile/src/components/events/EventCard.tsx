import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PressableScale } from "../ui/PressableScale";
import { colors, elevation, radius, spacing, type } from "../../theme";
import type { MeetupEvent } from "../../types/api";

interface EventCardProps {
  event: MeetupEvent;
  matchScore?: number;
  selected?: boolean;
  onPress: () => void;
  onOpen?: () => void;
}

const CATEGORY_GLYPH: Record<string, string> = {
  food: "🍜",
  gaming: "🎮",
  arts: "🎨",
  outdoor: "🥾",
};

/** A filled arc of the group's occupancy — size read at a glance, not counted. */
function OccupancyBar({ current, max }: { current: number; max: number }) {
  return (
    <View style={styles.pips} accessibilityElementsHidden>
      {Array.from({ length: max }).map((_, index) => (
        <View
          key={index}
          style={[styles.pip, index < current && styles.pipFilled]}
        />
      ))}
    </View>
  );
}

export function EventCard({
  event,
  matchScore,
  selected,
  onPress,
  onOpen,
}: EventCardProps) {
  const { t, i18n } = useTranslation();

  const when = new Date(event.start_time).toLocaleString(i18n.language, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  const full = event.current_size >= event.max_size;
  const score = matchScore != null ? Math.round(matchScore * 100) : null;

  return (
    <PressableScale
      accessibilityLabel={`${event.title}, ${event.venue_name}, ${when}, ${t(
        "discover.size",
        { current: event.current_size, max: event.max_size }
      )}${score != null ? `, ${t("discover.groupFit", { score })}` : ""}`}
      onPress={selected && onOpen ? onOpen : onPress}
      scaleTo={0.98}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.row}>
        <View style={[styles.glyphWell, selected && styles.glyphWellSelected]}>
          <Text style={styles.glyph}>
            {CATEGORY_GLYPH[event.category] ?? "📍"}
          </Text>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {event.venue_name} · {when}
          </Text>

          <View style={styles.footer}>
            <OccupancyBar current={event.current_size} max={event.max_size} />
            <Text style={styles.size}>
              {full
                ? t("discover.status.full")
                : t("discover.size", {
                    current: event.current_size,
                    max: event.max_size,
                  })}
            </Text>
          </View>
        </View>

        {score != null ? (
          <View style={styles.scoreWell}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreUnit}>%</Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md - 2,
    ...elevation.low,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md - 4 },
  glyphWell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphWellSelected: { backgroundColor: colors.surface },
  glyph: { fontSize: 22 },
  body: { flex: 1, gap: 2 },
  title: { ...type.bodyEmphasized, color: colors.text },
  meta: { ...type.footnote, color: colors.textMuted },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pips: { flexDirection: "row", gap: 3 },
  pip: {
    width: 14,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  pipFilled: { backgroundColor: colors.accent },
  size: { ...type.caption, color: colors.textMuted },
  scoreWell: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  scoreValue: { ...type.title3, color: colors.accent, fontWeight: "700" },
  scoreUnit: { ...type.caption, color: colors.accent, fontWeight: "700" },
});
