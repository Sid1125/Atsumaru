import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { Material } from "./Material";
import { colors } from "../../theme";

/**
 * Chrome that materialises as content passes beneath it.
 *
 * Apple's guidance is explicit that a sticky bar should not announce itself with a
 * 1px divider: the bar is transparent while the content sits below it, and gains a
 * material only once something is actually scrolled underneath. The divider says
 * "there is a bar here"; the material says "there is content above" — which is the
 * fact the user needs.
 *
 * Drive it from a scroll offset the caller already has. `DiscoverScreen`'s sheet
 * and `MeetupScreen` both run a `useAnimatedScrollHandler`, so this costs no extra
 * listener and stays entirely on the UI thread.
 *
 * The ramp is short on purpose — fully opaque by `threshold` points, default 24.
 * A long ramp reads as a fade-in effect; a short one reads as the bar simply being
 * there once it is needed.
 */
export function ScrollEdge({
  offset,
  threshold = 24,
  tone = "light",
  weight = "regular",
  children,
  style,
}: {
  /** Live scroll offset in points. Zero or negative means "at the top". */
  offset: SharedValue<number>;
  threshold?: number;
  tone?: "light" | "night";
  weight?: "thin" | "regular" | "thick";
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const material = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, threshold], [0, 1], "clamp"),
  }));

  return (
    <View style={style}>
      {/*
        The material is a sibling *behind* the content rather than a wrapper around
        it, so animating its opacity never touches the children — the label above it
        stays fully opaque from the first frame while the ground fades in under it.
        Wrapping would fade the text too, which is the usual mistake here.
      */}
      <Animated.View
        style={[StyleSheet.absoluteFill, material]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Material weight={weight} tone={tone} edge={false} style={styles.fill} />
        <View
          style={[
            styles.hairline,
            { backgroundColor: tone === "night" ? colors.nightSeparator : colors.separator },
          ]}
        />
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, borderRadius: 0 },
  /**
   * A hairline still appears — but only at full scroll, riding in with the
   * material rather than being permanently drawn. It is what gives the edge a
   * termination once the ground behind it is opaque.
   */
  hairline: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
});
