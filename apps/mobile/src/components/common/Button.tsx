import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { PressableScale } from "../ui/PressableScale";
import { colors, MIN_TARGET, radius, spacing, type } from "../../theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * `neon` is the electric CTA on night surfaces — the site's neon pill with a
   * hard offset vinyl shadow. `primary` is the coral pill with a coral glow.
   */
  variant?: "primary" | "secondary" | "tinted" | "plain" | "neon";
  size?: "regular" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
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
            {leadingIcon}
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

  // The neon CTA is vinyl: a hard offset shadow under the pill, exactly the
  // site's sticker-badge look on dark surfaces. The underlay is a plain shifted
  // View because RN elevation cannot do hard shadows.
  if (variant === "neon") {
    return (
      <View>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          style={[styles.vinylShadow, { top: 3, left: 3 }]}
        />
        {surface}
      </View>
    );
  }

  return surface;
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TARGET,
    paddingHorizontal: spacing.lg,
    // Pill — the site's CTA shape (site/components/ui/Button.tsx `rounded-full`).
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
  primary: {
    backgroundColor: colors.primary,
    // Coral glow — the site's `shadow-accent/20` lifted: the CTA reads as lit,
    // not just floated.
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      default: { elevation: 4 },
    }),
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tinted: { backgroundColor: colors.primarySoft },
  plain: { backgroundColor: "transparent" },
  /** Neon keeps no soft shadow — the hard underlay is its shadow. */
  neon: { backgroundColor: colors.primary },
  vinylShadow: {
    position: "absolute",
    right: 0,
    bottom: 0,
    borderRadius: radius.pill,
    backgroundColor: "rgba(9,9,11,0.9)",
  },
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
  label: { ...type.headline },
  labelOnColor: { color: colors.primaryText },
  labelOnSurface: { color: colors.text },
  labelTinted: { color: colors.primary },
});