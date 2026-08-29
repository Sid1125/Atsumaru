import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "../ui/PressableScale";
import { colors, radius, spacing, type } from "../../theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Leading glyph; never the only carrier of meaning (docs/DESIGN.md §10). */
  icon?: string;
  tone?: "neutral" | "accent";
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone = "accent",
}: ChipProps) {
  const body = (
    <View style={styles.row}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text
        style={[styles.label, selected && styles.labelSelected]}
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

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      scaleTo={0.94}
      style={surface}
    >
      {body}
    </PressableScale>
  );
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
