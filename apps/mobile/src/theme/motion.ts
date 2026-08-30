/**
 * Motion system.
 *
 * Apple replaced the physics triplet (mass/stiffness/damping) with two
 * designer-facing parameters — **damping ratio** (overshoot) and **response**
 * (how quickly it reaches the target, in seconds). Reanimated wants mass /
 * stiffness / damping, so this module converts, and every animation in the app
 * is specified in the designer terms rather than hand-tuned stiffness numbers.
 *
 *   ω  = 2π / response
 *   k  = m · ω²
 *   c  = 2 · ζ · m · ω
 *
 * Defaults follow the skill: critically damped (ζ = 1.0) for anything that just
 * appears, a little bounce (ζ ≈ 0.8) only where the gesture itself carried
 * momentum — overshoot on a flicked card feels right, on a fading menu it does not.
 */

import { AccessibilityInfo } from "react-native";
import { useEffect, useState } from "react";
import { type WithSpringConfig, type WithTimingConfig, Easing } from "react-native-reanimated";

interface AppleSpring {
  /** Damping ratio ζ. 1.0 = no overshoot. < 1 bounces. */
  damping: number;
  /** Seconds to reach the target. Not a duration — a spring has none. */
  response: number;
}

export function spring({ damping, response }: AppleSpring): WithSpringConfig {
  const mass = 1;
  const omega = (2 * Math.PI) / response;

  return {
    mass,
    stiffness: mass * omega * omega,
    damping: 2 * damping * mass * omega,
    // Reanimated 4 settles on total energy rather than separate displacement and
    // speed thresholds. Tighter than the default so a spring never visibly stops
    // short of its target, which reads as a glitch rather than a settle.
    energyThreshold: 1e-9,
  };
}

/** The values Apple actually ships, from the fluid-interfaces talk. */
export const springs = {
  /** Default for anything that simply moves into place. */
  standard: spring({ damping: 1.0, response: 0.4 }),
  /** Snappier — presses, small chrome, selection. */
  snappy: spring({ damping: 1.0, response: 0.25 }),
  /** Sheets and drawers. Slight overshoot; they are always gesture-driven. */
  sheet: spring({ damping: 0.82, response: 0.32 }),
  /** Momentum landings after a flick. */
  momentum: spring({ damping: 0.8, response: 0.4 }),
  /** The mutual-match moment — the one place extra life is earned. */
  celebrate: spring({ damping: 0.55, response: 0.5 }),
} as const;

/** Non-gesture fades. Springs are for things the user can touch. */
export const timings = {
  fast: { duration: 140, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  base: { duration: 220, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
  slow: { duration: 320, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
  /** Ambient float for decorative elements — a gentle sine bob, never a spring. */
  float: { duration: 2600, easing: Easing.inOut(Easing.sin) } satisfies WithTimingConfig,
};

/**
 * Momentum projection — where a flick would come to rest (skill §6).
 * This is Apple's exponential-decay form, not the textbook v²/2a.
 */
export function projectDecay(velocity: number, decelerationRate = 0.998): number {
  "worklet";
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Progressive resistance past a boundary (skill §9). A hard stop reads as frozen;
 * resistance reads as "responsive, but there is nothing more here".
 */
export function rubberband(
  overshoot: number,
  dimension: number,
  constant = 0.55
): number {
  "worklet";
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}

/** Nearest snap point to a projected landing position. */
export function nearestSnap(value: number, snapPoints: number[]): number {
  "worklet";
  let best = snapPoints[0]!;
  let bestDistance = Math.abs(value - best);

  for (const point of snapPoints) {
    const distance = Math.abs(value - point);
    if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * Reduced motion is not "no feedback" — it is a gentler, non-vestibular
 * equivalent (skill §14). Components read this and swap springs for short
 * cross-fades while keeping the state change legible.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => setReduced(value)
    );

    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
