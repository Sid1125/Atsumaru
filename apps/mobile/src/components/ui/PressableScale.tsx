import { type ReactNode, useCallback } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { HIT_SLOP, springs, useReducedMotion } from "../../theme";

type Feedback = "none" | "light" | "medium" | "success";

interface PressableScaleProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** How far it compresses. Big surfaces move less than small ones. */
  scaleTo?: number;
  haptic?: Feedback;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: "button" | "link" | "tab";
  accessibilityState?: { selected?: boolean; disabled?: boolean };
  testID?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The press primitive for the whole app.
 *
 * Two rules from the fluid-interfaces work are non-negotiable here:
 *   1. **Feedback lands on press-down, not on release.** Waiting for the tap to
 *      complete before showing anything is what makes an interface feel dead.
 *   2. **The scale is a spring, not a timed transition**, so a press that is
 *      released mid-compression reverses smoothly from wherever it actually is
 *      rather than jumping to a target and easing back.
 *
 * Haptics fire on the same frame as the visual commit (skill §13 — harmony).
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  scaleTo = 0.97,
  haptic = "light",
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = "button",
  accessibilityState,
  testID,
}: PressableScaleProps) {
  const pressed = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => {
    // Only emit `opacity` when this component is actually driving it. Writing
    // `opacity: 1` unconditionally silently overrode the opacity callers set on
    // the same element — which made every disabled button render at full
    // strength, since the animated style is merged last.
    if (reducedMotion) {
      // Reduced motion keeps the feedback but drops the movement (skill §14).
      return { opacity: 1 - pressed.value * 0.25 };
    }

    return {
      transform: [{ scale: 1 - pressed.value * (1 - scaleTo) }],
    };
  });

  const handlePressIn = useCallback(() => {
    if (reducedMotion) {
      pressed.value = 1;
      return;
    }
    pressed.value = withSpring(1, springs.snappy);
  }, [pressed, reducedMotion]);

  const handlePressOut = useCallback(() => {
    if (reducedMotion) {
      pressed.value = 0;
      return;
    }
    pressed.value = withSpring(0, springs.snappy);
  }, [pressed, reducedMotion]);

  const handlePress = useCallback(() => {
    if (haptic !== "none") {
      const style =
        haptic === "success"
          ? Haptics.NotificationFeedbackType.Success
          : haptic === "medium"
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;

      // Fire-and-forget: a device without a taptic engine must not break the tap.
      if (haptic === "success") {
        void Haptics.notificationAsync(style as Haptics.NotificationFeedbackType);
      } else {
        void Haptics.impactAsync(style as Haptics.ImpactFeedbackStyle);
      }
    }

    onPress?.();
  }, [haptic, onPress]);

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      hitSlop={HIT_SLOP}
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      testID={testID}
    >
      {children}
    </AnimatedPressable>
  );
}
