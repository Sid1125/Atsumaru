import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, elevation, radius, spacing } from "../../theme";

type Emphasis = "flat" | "raised" | "payoff";

/**
 * `Card`'s dark twin — the surface for anything sitting on the night ground, and
 * for the moments that deserve to invert against the champagne page.
 *
 * There were four independent hand-rolled versions of this before: `VibeRecapCard`,
 * `FeedbackPanel`'s celebration branch, `MeetupScreen`'s celebration, and
 * `DiscoverScreen`'s sheet rows. They disagreed on radius, border, elevation and
 * whether the border existed at all — and one of them (`FeedbackPanel`) had a 2pt
 * coloured border with **no `borderRadius`**, so it drew square corners on a
 * rounded card. Four implementations is how that survives review.
 *
 * `emphasis` is the only axis, because depth on a dark ground is carried by
 * *surface lightness*, not by shadow — a shadow on near-black is invisible.
 */
export function NightCard({
  children,
  emphasis = "flat",
  style,
}: {
  children: ReactNode;
  /**
   * `flat` sits on the night ground · `raised` lifts a row off it ·
   * `payoff` is the celebration: a citrus hairline, reserved for the mutual match
   * and nothing else.
   */
  emphasis?: Emphasis;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.base, styles[emphasis], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flat: {
    backgroundColor: colors.night,
    borderColor: colors.nightSeparator,
  },
  raised: {
    backgroundColor: colors.nightRaised,
    borderColor: colors.nightSeparator,
  },
  /**
   * The one place a coloured border is allowed. `citrus` rather than `primary`
   * because Orange Zest on `night` measures 3.82:1 — too weak to read as a
   * deliberate edge — while Neon Citrus clears 8.66:1.
   *
   * `elevation.medium` is kept even though a shadow barely reads on this ground:
   * it separates the card from the page *behind* it when it appears mid-scroll.
   */
  payoff: {
    backgroundColor: colors.night,
    borderColor: colors.citrus,
    borderWidth: 1.5,
    ...elevation.medium,
  },
});
