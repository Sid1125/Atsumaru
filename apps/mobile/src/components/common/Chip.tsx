import { cloneElement, type ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "../ui/PressableScale";
import { Sticker } from "../ui/Sticker";
import { colors, radius, spacing, type } from "../../theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /**
   * Leading mark, passed without a colour — the chip tints it to match the
   * label (sticker ink when the chip wears a sticker, white when selected,
   * secondary text otherwise). Never the only carrier of meaning
   * (docs/DESIGN.md §10).
   */
  icon?: ReactElement<{ color?: string }>;
  /**
   * Overrides the announced label. Needed where the tap does something other
   * than "choose this" — a removable tag's tap DESTROYS it, and announcing only
   * the tag name gives a screen-reader user no way to know that.
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
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
  accessibilityLabel,
  accessibilityHint,
  sticker,
}: ChipProps) {
  const onColor = selected && sticker ? sticker.on : undefined;
  // The leading mark follows the same colour logic as the label: sticker ink,
  // selected white, secondary text otherwise.
  const iconColor =
    onColor ?? (selected ? colors.textOnColor : colors.textSecondary);

  const body = (
    <View style={styles.row}>
      {icon ? cloneElement(icon, { color: iconColor }) : null}
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

  const surface = [styles.chip, selected && styles.selected];

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
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
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
  /**
   * Selection is ink, not sage.
   *
   * Sage + white was the DEFAULT selected state (`tone="accent"`) and measures
   * ~3.1:1 at `type.subhead` 15pt — below WCAG AA. It was what onboarding traits,
   * create-event sizes, handle suggestions, feedback rejoin/connect and removable
   * tags all rendered. Ink + white clears ~15:1.
   *
   * Sage is also the trust/AI/compatibility semantic; using it as the universal
   * selection register blurred it toward being an action colour, which
   * docs/DESIGN.md §1b reserves for coral alone. Category chips still wear their
   * `sticker` pair, which carries its own AA-checked ink.
   */
  selected: { backgroundColor: colors.text, borderColor: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 2 },
  label: { ...type.subhead, color: colors.textSecondary },
  labelSelected: { color: colors.textOnColor, fontWeight: "600" },
});
