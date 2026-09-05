import { Image, StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "../../theme";

/**
 * Circle avatar. With a photo (`uri`), the image fills the circle; without one,
 * the initial on a handle-derived colour is the fallback — the same user always
 * gets the same colour, and two users in a group stay visually distinct.
 *
 * The initial is the *meaning* here, not decoration, so the ground and the ink
 * travel together as a `{ bg, on }` pair from `colors.avatar` and every pair
 * clears WCAG AA. The previous local palette hard-coded six hexes, two of them
 * category colours, and put white on gold at ~1.9:1.
 */

function pairForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return colors.avatar[Math.abs(hash) % colors.avatar.length]!;
}

const SIZES = {
  sm: { container: 32, text: 13 },
  md: { container: 44, text: 17 },
  lg: { container: 64, text: 26 },
} as const;

export function Avatar({
  id,
  label,
  uri,
  size = "md",
  style,
}: {
  /** User id or handle — used to derive a consistent colour. */
  id: string;
  /** Single character to display (usually the first letter of the handle). */
  label: string;
  /** A photo URL (or data URL in demo mode) to render instead of the initial. */
  uri?: string | null;
  size?: "sm" | "md" | "lg";
  style?: any;
}) {
  const s = SIZES[size];
  const pair = pairForId(id);

  return (
    <View
      style={[
        styles.container,
        { width: s.container, height: s.container, borderRadius: s.container / 2 },
        { backgroundColor: pair.bg },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: s.container, height: s.container, borderRadius: s.container / 2 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text style={[styles.text, { fontSize: s.text, color: pair.on }]}>
          {label.slice(0, 1).toUpperCase()}
        </Text>
      )}
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
    fontWeight: "700",
  },
});
