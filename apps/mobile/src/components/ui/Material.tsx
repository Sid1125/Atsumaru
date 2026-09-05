import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { BlurView } from "expo-blur";

import { colors, radius } from "../../theme";

type Weight = "thin" | "regular" | "thick";
type Tone = "light" | "night";

interface MaterialProps {
  /**
   * Optional: a material is just as often a *ground* with nothing in it — a scrim
   * behind floating chrome, the fill under a scroll edge — as it is a container.
   */
  children?: ReactNode;
  /**
   * Heavier materials separate structural regions; lighter ones draw attention
   * to interactive elements. Never stack two light materials — legibility
   * collapses.
   */
  weight?: Weight;
  /**
   * `night` backs chrome that floats over the map or a dark ground. Without it
   * this primitive could only ever serve cream surfaces, which is why it sat
   * unused while Discover hand-rolled opaque circles instead.
   */
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
  /** Bright top lip — light catching the edge of the material. */
  edge?: boolean;
  /**
   * Forwarded to whichever surface actually renders. A material is a layout box
   * like any other, and callers legitimately need to measure it — Discover
   * positions its filter rail directly below this one.
   */
  onLayout?: ViewProps["onLayout"];
}

const INTENSITY: Record<Weight, number> = {
  thin: 24,
  regular: 48,
  thick: 80,
};

/**
 * Fallback tints when blur is unavailable or transparency is reduced. These are
 * tokens rather than literals: the previous values were `#FBF7F2`, a cream that
 * is neither `colors.background` nor `palette.sand50` — a third value nobody chose.
 */
const SOLID: Record<Tone, Record<Weight, string>> = {
  light: {
    thin: colors.materialThin,
    regular: colors.materialRegular,
    thick: colors.background,
  },
  night: {
    thin: colors.materialNightThin,
    regular: colors.materialNightRegular,
    thick: colors.night,
  },
};

const EDGE: Record<Tone, string> = {
  light: colors.materialEdge,
  night: colors.materialNightEdge,
};

/**
 * A translucent surface with content passing underneath, rather than an opaque
 * bar that eats a fixed strip of the screen.
 *
 * Honors the RN equivalent of `prefers-reduced-transparency`: when the user asks
 * for reduced transparency the surface goes frosty-solid instead of blurred,
 * which is the accessible equivalent rather than a downgrade.
 */
export function Material({
  children,
  weight = "regular",
  tone = "light",
  style,
  edge = true,
  onLayout,
}: MaterialProps) {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let alive = true;

    // iOS-only signal; Android reports false and keeps the blur decision below.
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

  const edgeStyle = edge
    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: EDGE[tone] }
    : null;

  if (!useBlur) {
    return (
      <View
        onLayout={onLayout}
        style={[styles.base, { backgroundColor: SOLID[tone][weight] }, edgeStyle, style]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      onLayout={onLayout}
      intensity={INTENSITY[weight]}
      tint={tone === "night" ? "dark" : "light"}
      style={[styles.base, edgeStyle, style]}
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
});
