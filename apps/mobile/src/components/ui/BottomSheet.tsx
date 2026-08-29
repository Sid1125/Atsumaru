import { type ReactNode, useCallback, useEffect, useImperativeHandle, forwardRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import {
  colors,
  elevation,
  nearestSnap,
  projectDecay,
  radius,
  rubberband,
  spacing,
  springs,
  useReducedMotion,
} from "../../theme";

export type SheetDetent = "peek" | "half" | "full";

export interface BottomSheetHandle {
  snapTo: (detent: SheetDetent) => void;
}

interface BottomSheetProps {
  children: ReactNode;
  /** Always-visible header; also the drag surface. */
  header?: ReactNode;
  initial?: SheetDetent;
  onDetentChange?: (detent: SheetDetent) => void;
}

/**
 * A detented sheet in the Apple Maps idiom: content and map share the screen,
 * and the sheet is dragged rather than toggled.
 *
 * The behaviours that matter:
 *   • **1:1 tracking** while dragging, from wherever it was grabbed.
 *   • **The landing detent is chosen from projected momentum, not the release
 *     position** — a flick throws the sheet, a slow drag settles nearby.
 *   • **Interruptible**: grabbing a moving sheet reads its live value and
 *     continues from there, so it can be reversed mid-flight without a jump.
 *   • **Rubber-banding** past the top detent instead of a dead stop.
 *   • A haptic on the frame the detent actually changes (skill §13, causality).
 */
export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(
  function BottomSheet({ children, header, initial = "half", onDetentChange }, ref) {
    const { height } = useWindowDimensions();
    const reducedMotion = useReducedMotion();

    // Translate-Y offsets from the top of the screen. Larger = further down.
    const detents = {
      full: Math.round(height * 0.12),
      half: Math.round(height * 0.52),
      peek: Math.round(height * 0.8),
    };

    const snapPoints = [detents.full, detents.half, detents.peek];

    const y = useSharedValue(detents[initial]);
    const startY = useSharedValue(0);
    const current = useSharedValue<SheetDetent>(initial);

    const notify = useCallback(
      (detent: SheetDetent) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDetentChange?.(detent);
      },
      [onDetentChange]
    );

    const detentFor = useCallback(
      (value: number): SheetDetent => {
        "worklet";
        if (value === detents.full) return "full";
        if (value === detents.peek) return "peek";
        return "half";
      },
      [detents.full, detents.peek]
    );

    const settle = useCallback(
      (target: number, velocity: number) => {
        "worklet";
        const detent = detentFor(target);

        if (detent !== current.value) {
          current.value = detent;
          runOnJS(notify)(detent);
        }

        y.value = withSpring(target, {
          ...springs.sheet,
          velocity,
        });
      },
      [current, detentFor, notify, y]
    );

    useImperativeHandle(ref, () => ({
      snapTo: (detent: SheetDetent) => {
        const target = detents[detent];
        if (current.value !== detent) {
          current.value = detent;
          onDetentChange?.(detent);
        }
        y.value = withSpring(target, springs.sheet);
      },
    }));

    const pan = Gesture.Pan()
      .minDistance(4)
      .onStart(() => {
        // Live value, so a re-grab mid-spring continues rather than snapping.
        startY.value = y.value;
      })
      .onUpdate((event) => {
        const next = startY.value + event.translationY;

        // Resist above the top detent; below the bottom one it simply follows,
        // because dragging a sheet down toward dismissal should feel free.
        y.value =
          next < detents.full
            ? detents.full - rubberband(detents.full - next, height)
            : Math.min(next, detents.peek + 40);
      })
      .onEnd((event) => {
        const projected = y.value + projectDecay(event.velocityY);
        settle(nearestSnap(projected, snapPoints), event.velocityY);
      });

    useEffect(() => {
      y.value = withSpring(detents[initial], springs.sheet);
      // Only on mount / height change; detents are derived from height.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [height]);

    const sheetStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: y.value }],
    }));

    const content = (
      <Animated.View style={[styles.sheet, { height }, sheetStyle]}>
        <View style={styles.grabberRow}>
          <View style={styles.grabber} />
        </View>
        {header}
        <View style={styles.body}>{children}</View>
      </Animated.View>
    );

    // Reduced motion keeps the sheet, drops the throwable physics.
    if (reducedMotion) {
      return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">{content}</View>;
    }

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <GestureDetector gesture={pan}>{content}</GestureDetector>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    ...elevation.high,
  },
  grabberRow: { alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.xs },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(26,22,19,0.18)",
  },
  body: { flex: 1 },
});
