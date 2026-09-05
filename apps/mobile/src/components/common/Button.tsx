import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { PressableScale } from "../ui/PressableScale";
import { VinylShadow } from "../ui/VinylShadow";
import { colors, MIN_TARGET, radius, spacing, type } from "../../theme";

interface ButtonProps {
  label: string;
  onPress: () => void;
  /**
   * `vinyl` is the CTA for night surfaces: the same action fill as `primary`, but
   * carried on a hard offset shadow instead of a soft glow — a sticker pressed
   * onto the dark ground rather than a button floating above it.
   *
   * It was called `neon` while it painted itself in a `colors.neon` that had
   * decayed into an alias of `primary`. The variant names a *finish*, not a hue,
   * which is the only part of it that was ever actually different.
   */
  variant?: "primary" | "secondary" | "tinted" | "plain" | "vinyl";
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
  const onVinyl = variant === "vinyl";

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
        onVinyl && styles.vinyl,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            color={
              onVinyl || variant === "primary" ? colors.primaryText : colors.text
            }
          />
        ) : (
          <>
            {leadingIcon}
            <Text
              style={[
                styles.label,
                onVinyl || variant === "primary"
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

  // The vinyl CTA: a hard offset shadow under the pill, exactly the site's
  // sticker-badge look on dark surfaces. The underlay is a plain shifted View
  // because RN elevation cannot do hard shadows.
  if (variant === "vinyl") {
    return (
      <View>
        <VinylShadow offset={3} borderRadius={radius.pill} />
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
  /**
   * The glow is iOS-only, and that is a decision rather than an omission.
   *
   * The intent is the site's `shadow-accent/20` — the CTA reading as *lit* in its
   * own colour. iOS `shadowColor` does exactly that. Android's `elevation` cannot
   * take a colour through RN style, so what it actually drew was a grey shadow —
   * and worse, a **rectangular** one: the elevation outline ignored the pill radius,
   * so a hard-cornered grey box sat behind every primary button. On a warm champagne
   * ground a grey shadow also greys the paper around it.
   *
   * A flat pill is better than a wrong shadow. Android gets its depth from the
   * `vinyl` variant, which is the app's own idiom and renders identically on both
   * platforms.
   */
  primary: {
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOpacity: 0.3,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      default: {},
    }),
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  tinted: { backgroundColor: colors.primarySoft },
  plain: { backgroundColor: "transparent" },
  /** Vinyl keeps no soft shadow — the hard underlay is its shadow. */
  vinyl: { backgroundColor: colors.primary },
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
  labelTinted: { color: colors.primaryInk },
});
