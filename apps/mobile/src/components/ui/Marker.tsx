import type { ReactNode } from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import { colors, spacing } from "../../theme";

/**
 * The site's highlighter mark (site/globals.css `.marker`): a lime band painted
 * behind short display text — the wordmark, a handle — so a key phrase reads as
 * hand-highlighted rather than set in a box. Ink flips to `citrusInk` on the band.
 * Use sparingly: the mark is the loudest move in the vocabulary.
 *
 * `alignSelf: "flex-start"` is load-bearing. A `<Text>` in a column stretches to
 * the container width, so without it the band ran the full width of the screen
 * with the words at one end — a highlighter stroke that missed.
 */
export function Marker({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.marker, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  marker: {
    alignSelf: "flex-start",
    backgroundColor: colors.citrus,
    color: colors.citrusInk,
    paddingHorizontal: spacing.xs + 1,
    borderRadius: 4,
    transform: [{ rotate: "-1.2deg" }],
  },
});