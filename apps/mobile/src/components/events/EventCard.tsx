import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PressableScale } from "../ui/PressableScale";
import { Sticker } from "../ui/Sticker";
import {
  categoryGlyph,
  categorySticker,
} from "../../categoryMeta";
import { colors, elevation, radius, spacing, type } from "../../theme";
import type { MeetupEvent } from "../../types/api";

interface EventCardProps {
  event: MeetupEvent;
  matchScore?: number;
  selected?: boolean;
  onPress: () => void;
  onOpen?: () => void;
  dark?: boolean;
}

function OccupancyBar({
  current,
  max,
  color,
}: {
  current: number;
  max: number;
  color: string;
}) {
  return (
    <View style={styles.pips} accessibilityElementsHidden>
      {Array.from({ length: max }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.pip,
            index < current && { backgroundColor: color },
          ]}
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
  dark,
}: EventCardProps) {
  const { t, i18n } = useTranslation();

  const when = new Date(event.start_time).toLocaleString(i18n.language, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  const full = event.current_size >= event.max_size;
  const score = matchScore != null ? Math.round(matchScore * 100) : null;

  const sticker = categorySticker(event.category);
  const glyph = categoryGlyph(event.category);

  return (
    <PressableScale
      accessibilityLabel={`${event.title}, ${event.venue_name}, ${when}, ${t(
        "discover.size",
        { current: event.current_size, max: event.max_size }
      )}${score != null ? `, ${t("discover.groupFit", { score })}` : ""}`}
      onPress={selected && onOpen ? onOpen : onPress}
      scaleTo={0.98}
      style={[
        styles.card,
        dark && styles.cardDark,
        selected && (dark ? styles.cardSelectedDark : styles.cardSelected),
      ]}
    >
      {/* Category accent strip */}
      <View style={[styles.accentStrip, { backgroundColor: sticker.bg }]} />

      <View style={styles.row}>
        <Sticker
          color={sticker.bg}
          borderRadius={radius.md}
          rotate={selected ? -2 : 0}
          style={styles.sticker}
        >
          <Text style={styles.glyph}>{glyph}</Text>
        </Sticker>

        <View style={styles.body}>
          <Text style={[styles.categoryKicker, { color: sticker.bg }]}>
            {t(`discover.categories.${event.category}`)}
          </Text>
          <Text style={[styles.title, dark && styles.titleDark]} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={[styles.meta, dark && styles.metaDark]} numberOfLines={1}>
            {event.venue_name} · {when}
          </Text>

          <View style={styles.footer}>
            <OccupancyBar
              current={event.current_size}
              max={event.max_size}
              color={sticker.bg}
            />
            <Text style={[styles.size, dark && styles.sizeDark]}>
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
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    ...elevation.low,
  },
  cardDark: {
    backgroundColor: colors.nightRaised,
    borderColor: colors.nightSeparator,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  cardSelectedDark: {
    borderColor: colors.neon,
    backgroundColor: colors.nightRaised,
  },
  accentStrip: {
    width: 4,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 4,
    padding: spacing.md - 2,
  },
  sticker: { width: 52, height: 52 },
  glyph: { fontSize: 24 },
  body: { flex: 1, gap: 2 },
  categoryKicker: { ...type.kicker, fontSize: 9, lineHeight: 12, letterSpacing: 1.8 },
  title: { ...type.bodyEmphasized, color: colors.text },
  titleDark: { color: colors.nightText },
  meta: { ...type.footnote, color: colors.textMuted },
  metaDark: { color: colors.nightMuted },
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
  size: { ...type.caption, color: colors.textMuted },
  sizeDark: { color: colors.nightMuted },
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
