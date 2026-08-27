import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing, typography } from "../../theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: { ...typography.caption, color: colors.text },
  selectedLabel: { color: colors.primaryText, fontWeight: "600" },
});
