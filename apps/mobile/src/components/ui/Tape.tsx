import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, spacing, type } from "../../theme";

export type TapeTone = "lime" | "coral" | "night";

const TONES: Record<TapeTone, { bg: string; on: string }> = {
  lime: { bg: colors.lime, on: colors.limeInk },
  coral: { bg: colors.primary, on: colors.primaryText },
  night: { bg: colors.nightRaised, on: colors.nightMuted },
};

/**
 * The site's tape badge (site/globals.css `.tape-badge`): a mono, uppercase,
 * slightly-rotated sticker sitting on a hard offset shadow. Where `Sticker`
 * carries category data, tape carries status/register — open, happening,
 * finished, "host" — in the electric band.
 */
export function Tape({
  label,
  tone = "lime",
  rotate = -2,
  offset = 2,
  style,
}: {
  label: string;
  tone?: TapeTone;
  rotate?: number;
  /** Hard-shadow depth in points. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];

  return (
    <View
      style={[
        rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null,
        style,
      ]}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        style={[styles.underlay, { top: offset, left: offset }]}
      />
      <View style={[styles.tape, { backgroundColor: t.bg }]}>
        <Text style={[styles.label, { color: t.on }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  underlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.sm,
    backgroundColor: "rgba(9,9,11,0.9)",
  },
  tape: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...type.kicker,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.8,
    fontWeight: "800",
  },
});