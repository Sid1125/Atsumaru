import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { PressableScale } from "../ui/PressableScale";
import { colors, elevation, MIN_TARGET, radius, spacing, type } from "../../theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "tinted" | "plain";
  size?: "regular" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  /** Leading glyph. Kept decorative — the label always carries the meaning. */
  icon?: string;
  haptic?: "none" | "light" | "medium" | "success";
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "regular",
  disabled,
  loading,
  style,
  icon,
  haptic = "light",
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      haptic={isDisabled ? "none" : haptic}
      // Large surfaces move less under the finger than small ones.
      scaleTo={size === "large" ? 0.975 : 0.96}
      style={[
        styles.base,
        size === "large" && styles.large,
        styles[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={variant === "primary" ? colors.primaryText : colors.text}
          />
        ) : (
          <>
            {icon ? <Text style={styles.icon}>{icon}</Text> : null}
            <Text
              style={[
                styles.label,
                variant === "primary" ? styles.labelOnColor : styles.labelOnSurface,
                variant === "tinted" && styles.labelTinted,
                isDisabled && styles.labelDisabled,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  large: { minHeight: 54, paddingHorizontal: spacing.xl },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primary: { backgroundColor: colors.primary, ...elevation.low },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...elevation.low,
  },
  tinted: { backgroundColor: colors.primarySoft },
  plain: { backgroundColor: "transparent" },
  /**
   * Disabled state is expressed in colour, not opacity. Opacity is owned by the
   * press animation on the same element, so a translucent "disabled" look was
   * silently overwritten — and a state this important should not depend on
   * whichever style happens to merge last.
   */
  disabled: {
    backgroundColor: colors.backgroundElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  labelDisabled: { color: colors.textMuted },
  icon: { fontSize: 17 },
  label: { ...type.headline },
  labelOnColor: { color: colors.primaryText },
  labelOnSurface: { color: colors.text },
  labelTinted: { color: colors.primary },
});
