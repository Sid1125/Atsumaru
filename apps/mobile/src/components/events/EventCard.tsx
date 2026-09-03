import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PressableScale } from "../ui/PressableScale";
import { IconChevronRight } from "../ui/Icons";
import { Sticker } from "../ui/Sticker";
import {
  categoryGlyph,
  categorySticker,
} from "../../categoryMeta";
import { colors, radius, spacing, type } from "../../theme";
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
  const text = dark ? styles.textDark : styles.text;

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
        selected && styles.cardSelected,
      ]}
    >
      <Sticker
        color={sticker.bg}
        borderRadius={radius.md}
        rotate={selected ? -2 : 0}
        style={styles.sticker}
      >
        <Text style={styles.glyph}>{glyph}</Text>
      </Sticker>

      <View style={styles.body}>
        <View style={styles.kickerRow}>
          <Text style={[styles.categoryKicker, { color: sticker.bg }]}>
            {t(`discover.categories.${event.category}`)}
          </Text>
          {score != null ? (
            <Text style={styles.scoreMark}>{score}%</Text>
          ) : null}
        </View>

        <Text style={[styles.title, text]} numberOfLines={1}>
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

      {/* Trailing open affordance — a chevron, not a button */}
      <IconChevronRight
        size={18}
        color={dark ? colors.nightMuted : colors.textMuted}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardDark: {
    backgroundColor: colors.nightRaised,
    borderColor: colors.nightSeparator,
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.nightRaisedSoft,
  },
  text: { color: colors.text },
  textDark: { color: colors.nightText },
  sticker: { width: 52, height: 52 },
  glyph: { fontSize: 24 },
  body: { flex: 1, gap: spacing.xxs },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryKicker: { ...type.overline },
  title: { ...type.bodyEmphasized },
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
    height: spacing.xs,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  size: { ...type.caption, color: colors.textMuted },
  sizeDark: { color: colors.nightMuted },
  scoreMark: {
    ...type.caption,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
