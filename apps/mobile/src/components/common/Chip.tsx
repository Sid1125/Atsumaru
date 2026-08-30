import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "../ui/PressableScale";
import { Sticker } from "../ui/Sticker";
import { colors, radius, spacing, type } from "../../theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Leading glyph; never the only carrier of meaning (docs/DESIGN.md §10). */
  icon?: string;
  tone?: "neutral" | "accent";
  /**
   * When set, the *selected* chip renders as a category sticker (site vinyl:
   * solid electric bg + hard offset shadow). Data-encoded, so colour pairs with
   * the label text that sits on it.
   */
  sticker?: { bg: string; on: string };
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone = "accent",
  sticker,
}: ChipProps) {
  const onColor = selected && sticker ? sticker.on : undefined;

  const body = (
    <View style={styles.row}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text
        style={[
          styles.label,
          onColor != null && { color: onColor },
          selected && styles.labelSelected,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );

  const surface = [
    styles.chip,
    selected && (tone === "accent" ? styles.selectedAccent : styles.selectedNeutral),
  ];

  // A chip with no handler is a tag, not a control — it should not report as a
  // button or take focus.
  if (!onPress) {
    return (
      <View style={surface} accessibilityRole="text">
        {body}
      </View>
    );
  }

  const pressable = (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      scaleTo={0.94}
      style={[
        surface,
        sticker && selected
          ? {
              backgroundColor: sticker.bg,
              borderColor: sticker.bg,
            }
          : null,
      ]}
    >
      {body}
    </PressableScale>
  );

  // Selected category chips wear the sticker; everything else stays a plain pill.
  if (sticker && selected) {
    return (
      <Sticker color={sticker.bg} borderRadius={radius.pill}>
        {pressable}
      </Sticker>
    );
  }

  return pressable;
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingVertical: spacing.sm - 1,
    paddingHorizontal: spacing.md - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: "center",
  },
  selectedAccent: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectedNeutral: { backgroundColor: colors.text, borderColor: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  icon: { fontSize: 14 },
  label: { ...type.subhead, color: colors.textSecondary },
  labelSelected: { color: colors.textOnColor, fontWeight: "600" },
});
