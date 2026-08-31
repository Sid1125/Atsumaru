import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { MapCanvas } from "./MapCanvas";
import { MapPin } from "./MapPin";
import { CENTER, project, WORLD } from "./geo";
import {
  CHROME_HEIGHT,
  EXPOSED_FRACTION,
  SHEET_MAX_EXPOSURE,
} from "./framing";
import {
  projectDecay,
  rubberband,
  springs,
  useReducedMotion,
} from "../../theme";
import type { MeetupEvent } from "../../types/api";

interface InteractiveMapProps {
  events: MeetupEvent[];
  selectedId: string | null;
  onSelect: (eventId: string) => void;
  onOpen: (eventId: string) => void;
}

const MAX_SCALE = 3.6;

/**
 * How much of the world the map shows across the viewport width on open. The
 * meetups cluster tightly around the station, so framing the whole 1400-unit
 * world would open on empty streets with the pins a speck in the middle.
 */
const INITIAL_SPAN = 620;

/**
 * The browsing surface.
 *
 * Everything the fluid-interfaces work asks for is here:
 *   • **1:1 tracking** — the map stays glued to the finger, offset from wherever
 *     it was grabbed, for the whole gesture rather than animating on release.
 *   • **Interruptible** — a moving map can be grabbed mid-flight and redirected;
 *     each gesture starts from the *current* value, never the target, so there is
 *     no jump on re-grab.
 *   • **Velocity handoff + momentum projection** — a flick lands where the throw
 *     was going (Apple's exponential decay), then springs in at the release
 *     velocity so there is no seam between dragging and animating.
 *   • **Rubber-banding** — edges resist progressively instead of stopping dead.
 *   • **X and Y are independent springs**, because a single 2-D spring desyncs
 *     when the axes carry different velocities.
 */
export function InteractiveMap({
  events,
  selectedId,
  onSelect,
  onOpen,
}: InteractiveMapProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // Gesture-start snapshots. Kept separate from the live values so a gesture
  // that begins mid-animation reads the presentation value and continues from it.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  const viewport = useSharedValue({ width: 0, height: 0 });
  /** Guards the one-time camera framing against re-layouts (rotation, keyboard). */
  const ready = useSharedValue(false);
  const reducedMotion = useReducedMotion();

  /**
   * The zoom floor is whatever still covers the viewport — below it the map
   * would be smaller than the screen and the background would show through.
   */
  const minScale = useSharedValue(1);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (!width || !height) return;

      viewport.value = { width, height };
      minScale.value = Math.max(width, height) / WORLD;

      if (!ready.value) {
        ready.value = true;

        const initial = Math.max(minScale.value, width / INITIAL_SPAN);
        const hub = project(CENTER);

        scale.value = initial;
        translateX.value = width / 2 - hub.x * initial;
        // Bias the hub above centre: the sheet covers the lower half, so the
        // visual centre of the *exposed* map is higher than the view's centre.
        translateY.value = height * 0.36 - hub.y * initial;
      }
    },
    [minScale, ready, scale, translateX, translateY, viewport]
  );

  /**
   * Travel limits for the current scale.
   *
   * The vertical limit is measured against the map area the sheet does *not*
   * cover, not the full view height. Clamping to the full height meant the world
   * could barely move vertically whenever its scaled height was close to the
   * screen's — which silently clamped away any attempt to frame content in the
   * visible band. The factor is the sheet's deepest resting exposure, so no
   * background can appear behind it at any detent.
   */
  const bounds = useCallback(
    (currentScale: number) => {
      "worklet";
      const { width, height } = viewport.value;
      const scaled = WORLD * currentScale;
      const usableHeight = height * SHEET_MAX_EXPOSURE;

      return {
        minX: Math.min(0, width - scaled),
        maxX: 0,
        minY: Math.min(0, usableHeight - scaled),
        maxY: 0,
      };
    },
    [viewport]
  );

  /**
   * Frame the annotations rather than a fixed point — the same thing a real map
   * app does when it opens on a set of results. Only the upper part of the view
   * is actually exposed (the sheet covers the rest), so the fit targets that
   * region instead of the full height.
   */
  const fitToEvents = useCallback(
    (points: { x: number; y: number }[], animated: boolean) => {
      const { width, height } = viewport.value;
      if (!width || points.length === 0) return;

      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const minPx = Math.min(...xs);
      const maxPx = Math.max(...xs);
      const minPy = Math.min(...ys);
      const maxPy = Math.max(...ys);

      /**
       * The usable band is bounded above by the floating chrome (identity row +
       * filter rail) and below by the sheet. Centring in the raw 0…sheet range
       * pushed the topmost pin behind the filters.
       */
      const chromeInset = CHROME_HEIGHT;
      const bandTop = chromeInset;
      const bandBottom = height * EXPOSED_FRACTION;
      const bandHeight = Math.max(160, bandBottom - bandTop);

      // Pins draw upward from their coordinate — bubble, stem and label all sit
      // above the point — so the top needs materially more room than the bottom.
      const padX = 80;
      const padTop = 120;
      const padBottom = 60;

      const spanX = Math.max(maxPx - minPx, 100) + padX * 2;
      const spanY = Math.max(maxPy - minPy, 100) + padTop + padBottom;

      const fitted = Math.min(width / spanX, bandHeight / spanY);
      const next = Math.min(
        MAX_SCALE,
        Math.max(minScale.value, Math.min(fitted, 2.4))
      );

      const centreX = (minPx + maxPx) / 2;
      const centreY = (minPy + maxPy) / 2;

      const targetX = width / 2 - centreX * next;
      // Bias slightly down inside the band so the tall pin labels clear the chrome.
      const targetY = bandTop + bandHeight * 0.56 - centreY * next;

      const { minX, maxX, minY, maxY } = bounds(next);
      const clampedX = Math.min(maxX, Math.max(minX, targetX));
      const clampedY = Math.min(maxY, Math.max(minY, targetY));

      if (!animated) {
        scale.value = next;
        translateX.value = clampedX;
        translateY.value = clampedY;
        return;
      }

      scale.value = withSpring(next, springs.standard);
      translateX.value = withSpring(clampedX, springs.standard);
      translateY.value = withSpring(clampedY, springs.standard);
    },
    [bounds, minScale, scale, translateX, translateY, viewport]
  );

  /** Progressive resistance rather than a hard stop (skill §9). */
  const clampWithResistance = useCallback(
    (value: number, min: number, max: number, dimension: number) => {
      "worklet";
      if (value > max) return max + rubberband(value - max, dimension);
      if (value < min) return min - rubberband(min - value, dimension);
      return value;
    },
    []
  );

  const pan = Gesture.Pan()
    // ~10px of hysteresis before committing to a drag, so taps stay taps.
    .minDistance(8)
    .onStart(() => {
      // Read the *live* value — this is what makes a re-grab mid-flight seamless.
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const { minX, maxX, minY, maxY } = bounds(scale.value);
      const { width, height } = viewport.value;

      translateX.value = clampWithResistance(
        startX.value + event.translationX,
        minX,
        maxX,
        width || 1
      );
      translateY.value = clampWithResistance(
        startY.value + event.translationY,
        minY,
        maxY,
        height || 1
      );
    })
    .onEnd((event) => {
      const { minX, maxX, minY, maxY } = bounds(scale.value);

      // Where would this throw come to rest? Land there, not at the release point.
      const projectedX = translateX.value + projectDecay(event.velocityX);
      const projectedY = translateY.value + projectDecay(event.velocityY);

      const targetX = Math.min(maxX, Math.max(minX, projectedX));
      const targetY = Math.min(maxY, Math.max(minY, projectedY));

      // Independent springs per axis, each handed the finger's own velocity.
      translateX.value = withSpring(targetX, {
        ...springs.momentum,
        velocity: event.velocityX,
      });
      translateY.value = withSpring(targetY, {
        ...springs.momentum,
        velocity: event.velocityY,
      });
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = Math.min(
        MAX_SCALE,
        // Allow a little travel below the floor so the pinch rubber-bands
        // rather than hitting a wall; onEnd springs it back.
        Math.max(minScale.value * 0.85, startScale.value * event.scale)
      );

      // Zoom about the pinch midpoint so the content under the fingers stays put.
      const ratio = next / startScale.value;
      translateX.value =
        event.focalX - (event.focalX - startX.value) * ratio;
      translateY.value =
        event.focalY - (event.focalY - startY.value) * ratio;
      scale.value = next;
    })
    .onEnd(() => {
      const settled = Math.min(MAX_SCALE, Math.max(minScale.value, scale.value));

      if (settled !== scale.value) {
        scale.value = withSpring(settled, springs.standard);
      }

      const { minX, maxX, minY, maxY } = bounds(settled);
      translateX.value = withSpring(
        Math.min(maxX, Math.max(minX, translateX.value)),
        springs.standard
      );
      translateY.value = withSpring(
        Math.min(maxY, Math.max(minY, translateY.value)),
        springs.standard
      );
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      const base = Math.max(minScale.value, 1.2);
      const target = scale.value > base * 1.5 ? base : base * 2;
      const ratio = target / scale.value;

      // Zoom toward the tap, not the screen centre — anchored to its source.
      translateX.value = withSpring(
        event.x - (event.x - translateX.value) * ratio,
        springs.standard
      );
      translateY.value = withSpring(
        event.y - (event.y - translateY.value) * ratio,
        springs.standard
      );
      scale.value = withSpring(target, springs.standard);

      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    });

  // Pan and pinch race together and both stay live; the double-tap only wins
  // when it actually completes, so single taps on pins are never delayed.
  const composed = Gesture.Simultaneous(
    pan,
    pinch,
    doubleTap
  );

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  /** Recentre on the selected meetup so selection and map agree. */
  const focusOn = useCallback(
    (event: MeetupEvent) => {
      const { width, height } = viewport.value;
      if (!width) return;

      const point = project(event.location);
      const targetScale = Math.max(scale.value, minScale.value * 1.35);
      const config = reducedMotion ? springs.snappy : springs.standard;

      scale.value = withSpring(targetScale, config);
      translateX.value = withSpring(
        width / 2 - point.x * targetScale,
        config
      );
      translateY.value = withSpring(
        height * 0.38 - point.y * targetScale,
        config
      );
    },
    [reducedMotion, scale, translateX, translateY, viewport]
  );

  useEffect(() => {
    const target = events.find((event) => event.id === selectedId);
    if (target) focusOn(target);
  }, [selectedId, events, focusOn]);

  /**
   * Frame the whole set once, when the first batch of events arrives — and again
   * if the category filter changes the set while nothing is selected. Re-framing
   * under an active selection would fight the user.
   */
  const framedFor = useRef<string>("");

  useEffect(() => {
    if (events.length === 0 || selectedId) return;

    const signature = events.map((event) => event.id).join("|");
    if (signature === framedFor.current) return;

    const first = framedFor.current === "";
    framedFor.current = signature;

    // A tick lets onLayout land before the first fit is computed.
    const timer = setTimeout(
      () => fitToEvents(events.map((event) => project(event.location)), !first),
      first ? 60 : 0
    );

    return () => clearTimeout(timer);
  }, [events, selectedId, fitToEvents]);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <GestureDetector gesture={composed}>
        <Animated.View style={styles.canvasHost}>
          <Animated.View style={[styles.canvas, canvasStyle]}>
            <MapCanvas />

            {events.map((event) => {
              const point = project(event.location);

              return (
                <MapPin
                  key={event.id}
                  event={event}
                  x={point.x}
                  y={point.y}
                  selected={event.id === selectedId}
                  mapScale={scale}
                  onPress={() => onSelect(event.id)}
                  onOpen={() => onOpen(event.id)}
                />
              );
            })}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: "#F1E9DC" },
  canvasHost: { flex: 1 },
  canvas: {
    position: "absolute",
    width: WORLD,
    height: WORLD,
    transformOrigin: "top left",
  },
});
