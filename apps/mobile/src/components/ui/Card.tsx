import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, elevation, radius, spacing } from "../../theme";

/**
 * The grouped-card surface: white paper, hairline border, low shadow. Before
 * this existed every screen restated the same four lines and they drifted
 * (border width, corner radius, shadow) — this is the single source for card
 * chrome. Content layout (gaps, padding tweaks) stays with the caller via
 * `style`.
 */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    ...elevation.low,
  },
});