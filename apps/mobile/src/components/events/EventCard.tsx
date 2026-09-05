import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PressableScale } from "../ui/PressableScale";
import { IconChevronRight } from "../ui/Icons";
import { Sticker } from "../ui/Sticker";
import { ScoreMark } from "./ScoreMark";
import { categoryIcon, categorySticker } from "../../categoryMeta";
import { colors, radius, spacing, type } from "../../theme";
import type { MeetupEvent } from "../../types/api";

/**
 * `featured` is the best match, and only ever the first row · `standard` is every
 * other meetup · `compact` is a meetup referenced from somewhere else, where the
 * card is a mention rather than the subject.
 */
type Variant = "featured" | "standard" | "compact";

interface EventCardProps {
  event: MeetupEvent;
  matchScore?: number;
  selected?: boolean;
  onPress: () => void;
  onOpen?: () => void;
  dark?: boolean;
  variant?: Variant;
}

function OccupancyBar({
  current,
  max,
  color,
  dark,
}: {
  current: number;
  max: number;
  color: string;
  dark?: boolean;
}) {
  return (
    <View style={styles.pips} accessibilityElementsHidden>
      {Array.from({ length: max }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.pip,
            dark && styles.pipDark,
            index < current && { backgroundColor: color },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * A meetup, as a row.
 *
 * ## Why there are three of these and not one
 *
 * `docs/VISUAL_OVERHAUL.md` states the card should be "an edge-to-edge editorial
 * row, no bg/elevation" and that cards "form a small family — featured / standard /
 * compact — never one identical padded rectangle everywhere." The code was the
 * thing that rule exists to prevent: one bordered rounded rect, repeated, with the
 * best match in the list rendered exactly like the worst.
 *
 * The family is built from *hierarchy*, not decoration — the featured row gets a
 * larger mark, a bigger title, more air and a tilt on its sticker. It does **not**
 * get a different colour, a shadow, or a badge the others lack: every member shows
 * the same kicker, the same score mark, the same occupancy pips and the same
 * trailing chevron, so the three read as one system at three weights rather than as
 * three components.
 */
export function EventCard({
  event,
  matchScore,
  selected,
  onPress,
  onOpen,
  dark,
  variant = "standard",
}: EventCardProps) {
  const { t, i18n } = useTranslation();

  const when = new Date(event.start_time).toLocaleString(i18n.language, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  const full = event.current_size >= event.max_size;
  const featured = variant === "featured";
  const compact = variant === "compact";

  const sticker = categorySticker(event.category);
  const CategoryMark = categoryIcon(event.category);

  const markSize = featured ? 64 : compact ? 40 : 52;

  return (
    <PressableScale
      accessibilityLabel={`${event.title}, ${event.venue_name}, ${when}, ${t(
        "discover.size",
        { current: event.current_size, max: event.max_size }
      )}${
        matchScore != null
          ? `, ${t("discover.groupFit", { score: Math.round(matchScore * 100) })}`
          : ""
      }`}
      onPress={selected && onOpen ? onOpen : onPress}
      scaleTo={0.98}
      style={[
        styles.card,
        featured && styles.cardFeatured,
        compact && styles.cardCompact,
        dark && styles.cardDark,
        selected && (dark ? styles.cardSelectedDark : styles.cardSelected),
      ]}
    >
      <Sticker
        color={sticker.bg}
        borderRadius={featured ? radius.lg : radius.md}
        // Only the featured mark tilts, and only when chosen. A row of tilted
        // stickers is noise; one tilted sticker is a focal point.
        rotate={featured ? -3 : selected ? -2 : 0}
        offset={featured ? 4 : 3}
        style={{ width: markSize, height: markSize }}
      >
        <CategoryMark size={markSize * 0.46} color={sticker.on} />
      </Sticker>

      <View style={styles.body}>
        <View style={styles.kickerRow}>
          {/* Muted, not the category colour: `sticker.bg` is a *background* and
              fails contrast as text. The colour still carries the category on the
              sticker beside this, where it has its paired ink. */}
          <Text style={[styles.categoryKicker, dark && styles.categoryKickerDark]}>
            {t(`discover.categories.${event.category}`)}
          </Text>
          {matchScore != null ? <ScoreMark score={matchScore} dark={dark} /> : null}
        </View>

        <Text
          style={[
            featured ? styles.titleFeatured : styles.title,
            dark ? styles.textDark : styles.text,
          ]}
          numberOfLines={featured ? 2 : 1}
        >
          {event.title}
        </Text>
        <Text style={[styles.meta, dark && styles.metaDark]} numberOfLines={1}>
          {event.venue_name} · {when}
        </Text>

        {/* The compact row drops the occupancy strip — at that weight the card is a
            reference to a meetup, not a decision about one. */}
        {!compact ? (
          <View style={styles.footer}>
            <OccupancyBar
              current={event.current_size}
              max={event.max_size}
              color={sticker.bg}
              dark={dark}
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
        ) : null}
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
  /**
   * Transparent with a bottom hairline — the documented editorial row. It was a
   * bordered rounded rect with a background, which is what made a list of these
   * read as a stack of identical tiles instead of a page.
   *
   * `overflow` is deliberately NOT hidden: the category sticker's vinyl offset
   * draws a few points outside its own bounds, and clipping the row would clip the
   * shadow off with it.
   */
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cardDark: { borderBottomColor: colors.nightSeparator },
  cardFeatured: { paddingVertical: spacing.lg, gap: spacing.md },
  cardCompact: { paddingVertical: spacing.sm + 2 },
  /**
   * Selection is a left rule, not a filled tile. On an edge-to-edge row there is no
   * card to tint, and the old `cardSelected` forced a night background
   * unconditionally — so on a cream ground it painted dark ink on a dark fill.
   */
  cardSelected: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm + 1,
  },
  cardSelectedDark: {
    borderLeftWidth: 3,
    borderLeftColor: colors.citrus,
    paddingLeft: spacing.sm + 1,
  },
  text: { color: colors.text },
  textDark: { color: colors.nightText },
  body: { flex: 1, gap: spacing.xxs },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryKicker: { ...type.overline, color: colors.textMuted },
  categoryKickerDark: { color: colors.nightMuted },
  title: { ...type.bodyEmphasized },
  titleFeatured: { ...type.title3 },
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
  // The unfilled pips need their own dark value, or the "remaining seats" track
  // renders in a cream border colour on the night sheet and reads as filled.
  pipDark: { backgroundColor: colors.nightSeparator },
  size: { ...type.caption, color: colors.textMuted },
  sizeDark: { color: colors.nightMuted },
});
