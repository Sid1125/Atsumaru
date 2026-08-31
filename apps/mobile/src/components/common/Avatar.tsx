import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "../../theme";

/**
 * Coloured circle with the user's initial — the site's social avatar pattern
 * (site/globals.css hero section). Color is derived from the handle so the same
 * user always gets the same colour, and two users in a group are visually
 * distinct. The initial carries the meaning; colour is decoration (DESIGN.md §10).
 */

const AVATAR_COLORS = [
  "#E8634D", // coral
  "#7A9E7E", // sage
  "#E4C25C", // gold
  "#8B7EC8", // purple
  "#FF2E93", // hotpink
  "#00B4D8", // cyan
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

const SIZES = {
  sm: { container: 32, text: 13 },
  md: { container: 44, text: 17 },
  lg: { container: 64, text: 26 },
} as const;

export function Avatar({
  id,
  label,
  size = "md",
  style,
}: {
  /** User id or handle — used to derive a consistent colour. */
  id: string;
  /** Single character to display (usually the first letter of the handle). */
  label: string;
  size?: "sm" | "md" | "lg";
  style?: any;
}) {
  const s = SIZES[size];

  return (
    <View
      style={[
        styles.container,
        { width: s.container, height: s.container, borderRadius: s.container / 2 },
        { backgroundColor: colorForId(id) },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: s.text }]}>
        {label.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    ...type.headline,
    color: colors.textOnColor,
    fontWeight: "700",
  },
});
