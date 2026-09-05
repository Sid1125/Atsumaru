import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "../ui/PressableScale";
import { IconChevronRight } from "../ui/Icons";
import { colors, radius, spacing, type } from "../../theme";

/**
 * The "this opens somewhere" row.
 *
 * Three identical implementations of this existed — `WrapUpRow`, `GroupChatCard`
 * and `ConnectionsScreen`'s row — down to the same 28pt chevron well and the same
 * gap. They were written separately, which is why the meetup's "leave feedback" and
 * the connections list read as two different products despite doing the same thing.
 *
 * The chevron sits in a filled well rather than floating. A bare chevron on a wide
 * row has nothing to anchor it and drifts optically toward the text; the well gives
 * it a fixed mass at the end of the line, and it is the shape the whole "open a
 * destination" family shares.
 */
export function EditorialRow({
  /** Mono label above the title. Use sparingly — see the kicker budget in `type`. */
  kicker,
  title,
  detail,
  /** Replaces the chevron well: a badge, a count, an avatar stack. */
  trailing,
  leading,
  onPress,
  onPressIn,
  emphasis,
  tone = "light",
  accessibilityLabel,
  accessibilityHint,
}: {
  kicker?: string;
  title: string;
  detail?: string;
  trailing?: ReactNode;
  leading?: ReactNode;
  onPress: () => void;
  /** Fires ~100ms before navigation — the hook for prefetching a destination. */
  onPressIn?: () => void;
  /** Paints the title in the action ink. For the one row that is the point. */
  emphasis?: boolean;
  tone?: "light" | "night";
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const night = tone === "night";

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      onPressIn={onPressIn}
      // Rows are large surfaces: they move less under the finger than a chip does,
      // or the whole line appears to lurch.
      scaleTo={0.98}
      style={styles.row}
    >
      {leading}

      <View style={styles.body}>
        {kicker ? (
          <Text style={[styles.kicker, night && styles.kickerNight]}>{kicker}</Text>
        ) : null}
        <Text
          style={[
            styles.title,
            night && styles.titleNight,
            emphasis && !night && styles.titleEmphasis,
            emphasis && night && styles.titleEmphasisNight,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {detail ? (
          <Text style={[styles.detail, night && styles.detailNight]} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>

      {trailing ?? (
        <View style={[styles.well, night && styles.wellNight]}>
          <IconChevronRight
            size={16}
            color={night ? colors.nightMuted : colors.textMuted}
          />
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 2,
    paddingVertical: spacing.sm + 2,
  },
  // 8–12pt inside a group. The row's own parts belong together; the space that
  // separates this row from the next section is the caller's job.
  body: { flex: 1, gap: spacing.xxs },
  kicker: { ...type.overline, color: colors.textMuted },
  kickerNight: { color: colors.nightMuted },
  title: { ...type.bodyEmphasized, color: colors.text },
  titleNight: { color: colors.nightText },
  // The action colour at its ink weight — `primary` as 17pt text is 3.79:1.
  titleEmphasis: { color: colors.primaryInk },
  // ...and on night it is 3.82:1, so the emphasis there is citrus instead.
  titleEmphasisNight: { color: colors.citrus },
  detail: { ...type.footnote, color: colors.textMuted },
  detailNight: { color: colors.nightMuted },
  well: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  wellNight: { backgroundColor: colors.nightRaisedSoft },
});
