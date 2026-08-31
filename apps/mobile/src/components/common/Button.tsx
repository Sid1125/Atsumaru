import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { PressableScale } from "../ui/PressableScale";
import { colors, elevation, MIN_TARGET, radius, spacing, type } from "../../theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** `neon` is the electric CTA — the site's neon pill on night surfaces. */
  variant?: "primary" | "secondary" | "tinted" | "plain" | "neon";
  size?: "regular" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  /** Leading glyph. Kept decorative — the label always carries the meaning. */
  icon?: string;
  /** Leading ReactNode — use for SVG logos or complex icons. */
  leadingIcon?: React.ReactNode;
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
  leadingIcon,
  haptic = "light",
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const onNeon = variant === "neon";

  const surface = (
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
        onNeon && styles.neon,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={onNeon ? colors.neonText : variant === "primary" ? colors.primaryText : colors.text}
          />
        ) : (
          <>
            {leadingIcon ?? (icon ? <Text style={styles.icon}>{icon}</Text> : null)}
            <Text
              style={[
                styles.label,
                onNeon
                  ? styles.labelOnNeon
                  : variant === "primary"
                    ? styles.labelOnColor
                    : styles.labelOnSurface,
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

  // Neon CTA — flat neon pill, no vinyl shadow wrapper (that layout breaks).
  return surface;
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TARGET,
    paddingHorizontal: spacing.lg,
    // Substantial, rectangular — restrained corner, never a capsule. The CTA
    // reads as a solid editorial slab (JOIN MEETUP →), not a rounded button.
    borderRadius: radius.xs,
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
  /** Neon pill keeps no soft shadow — the hard underlay is its shadow. */
  neon: { backgroundColor: colors.neon },
  labelOnNeon: { color: colors.neonText },
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
