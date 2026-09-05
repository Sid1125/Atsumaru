import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, spacing, type } from "../../theme";

/**
 * The editorial page header.
 *
 * There were five header patterns across twelve screens. Three of them printed
 * their title twice — once in the navigation bar and again in the body — and
 * `ConnectionsScreen` printed none at all. The mono label above the title was
 * `type.overline` in six places, `sectionHeader` in another, and `type.kicker` in
 * one, at three different sizes.
 *
 * ## The kicker is rationed
 *
 * `kicker` is optional and should stay that way. It is the loudest quiet element in
 * the system, and the app had **39 mono labels across ~12 screens** — roughly one
 * above every block, which is the single most reliable way to make an interface
 * read as generated. The working rule is **at most one per three sections**, and a
 * screen header is the one that earns it. If a section below also wants one, this
 * one should probably go.
 *
 * ## Sizing
 *
 * `size` picks the tier, and the choice is about what the screen *is*, not how much
 * room there is. `display` is for a screen that is about one thing — a meetup, a
 * profile. `title` is for a screen that is a list of things.
 */
export function ScreenHeader({
  kicker,
  title,
  subtitle,
  trailing,
  size = "title",
  tone = "light",
  style,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  /** Sits on the title's baseline row — a CTA, a count, a control. */
  trailing?: ReactNode;
  size?: "title" | "display";
  tone?: "light" | "night";
  style?: StyleProp<ViewStyle>;
}) {
  const night = tone === "night";

  return (
    <View style={[styles.header, style]}>
      {kicker ? (
        <Text style={[styles.kicker, night && styles.kickerNight]}>{kicker}</Text>
      ) : null}

      <View style={styles.titleRow}>
        <Text
          style={[
            size === "display" ? styles.display : styles.title,
            night && styles.onNight,
          ]}
          // A header is the one place a long title should wrap rather than clip —
          // truncating the name of the thing you are looking at is never right.
          numberOfLines={2}
          // Screen readers announce this as the heading it visually is.
          accessibilityRole="header"
        >
          {title}
        </Text>
        {trailing}
      </View>

      {subtitle ? (
        <Text style={[styles.subtitle, night && styles.subtitleNight]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Tight internal rhythm: kicker, title and subtitle are one group, so they sit
  // at the 4–8pt end of the scale. Separation from the content below belongs to
  // whatever renders this.
  header: { gap: spacing.xs },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  kicker: { ...type.kicker, color: colors.primaryInk },
  // On night, the action colour drops to 3.82:1 — citrus is the legible ink there.
  kickerNight: { color: colors.citrus },
  display: { ...type.display, color: colors.text, flex: 1 },
  title: { ...type.title1, color: colors.text, flex: 1 },
  onNight: { color: colors.nightText },
  subtitle: { ...type.callout, color: colors.textMuted },
  subtitleNight: { color: colors.nightMuted },
});
