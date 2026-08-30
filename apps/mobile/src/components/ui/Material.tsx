import { type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";

import { colors, radius } from "../../theme";

type Weight = "thin" | "regular" | "thick";

interface MaterialProps {
  children: ReactNode;
  /**
   * Heavier materials separate structural regions; lighter ones draw attention
   * to interactive elements (skill §12). Never stack two light materials — the
   * legibility collapses.
   */
  weight?: Weight;
  style?: StyleProp<ViewStyle>;
  /** Bright top edge — light catching the lip of the material. */
  edge?: boolean;
}

const INTENSITY: Record<Weight, number> = {
  thin: 24,
  regular: 48,
  thick: 80,
};

/** Fallback tints when blur is unavailable or transparency is reduced. */
const SOLID: Record<Weight, string> = {
  thin: "rgba(251,247,242,0.86)",
  regular: "rgba(251,247,242,0.94)",
  thick: colors.background,
};

/**
 * A translucent surface with content passing underneath, rather than an opaque
 * bar that eats a fixed strip of the screen (skill §12).
 *
 * Honors `prefers-reduced-transparency`'s RN equivalent: when the user asks for
 * reduced transparency the surface goes frosty-solid instead of blurred, which
 * is the accessible equivalent rather than a downgrade.
 */
export function Material({
  children,
  weight = "regular",
  style,
  edge = true,
}: MaterialProps) {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let alive = true;

    // iOS-only signal; Android reports false and keeps the blur.
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((value) => {
      if (alive) setReduceTransparency(value);
    });

    return () => {
      alive = false;
    };
  }, []);

  // Android's blur is materially weaker than iOS'; a tinted solid reads better
  // than a washed-out approximation of glass.
  const useBlur = !reduceTransparency && Platform.OS === "ios";

  if (!useBlur) {
    return (
      <View
        style={[
          styles.base,
          { backgroundColor: SOLID[weight] },
          edge && styles.edge,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={INTENSITY[weight]}
      tint="light"
      style={[styles.base, edge && styles.edge, style]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  edge: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.7)",
  },
});

export { colors as materialColors };
