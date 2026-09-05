import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { VinylShadow } from "./VinylShadow";
import { colors, radius, spacing, type } from "../../theme";

export type TapeTone = "citrus" | "action" | "night";

const TONES: Record<TapeTone, { bg: string; on: string }> = {
  citrus: { bg: colors.citrus, on: colors.citrusInk },
  action: { bg: colors.primary, on: colors.primaryText },
  night: { bg: colors.nightRaised, on: colors.nightMuted },
};

/**
 * The site's tape badge (site/globals.css `.tape-badge`): a mono, uppercase,
 * slightly-rotated sticker sitting on a hard offset shadow. Where `Sticker`
 * carries category data, tape carries status/register — open, happening,
 * finished, "host" — in the electric band.
 *
 * `citrus` is the default electric register, `action` the Orange Zest fill, `night`
 * the quiet one. The tones are named for the register they carry, not for a hue —
 * `lime` and `coral` had to be renamed the moment the palette moved.
 */
export function Tape({
  label,
  tone = "citrus",
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
      <VinylShadow offset={offset} borderRadius={radius.sm} />
      <View style={[styles.tape, { backgroundColor: t.bg }]}>
        <Text style={[styles.label, { color: t.on }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tape: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xxs + 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // `overline` rather than `kicker` with three overrides. Tape carries a status,
  // not a section heading — and the old version re-declared size, leading, tracking
  // and weight, which is a new role wearing another role's name.
  label: { ...type.overline, fontSize: 10, lineHeight: 13, letterSpacing: 2.2 },
});