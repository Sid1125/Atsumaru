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

/**
 * The entrance curve. Front-loaded and long-tailed: it leaves immediately, which is
 * what makes an element feel like it was already on its way, then eases out over a
 * long tail so it never appears to stop dead.
 *
 * `Easing.out(Easing.cubic)` is the safe default and is what `base`/`slow` use.
 * This is the one to reach for when an element is *arriving* and should feel
 * composed rather than merely fast.
 */
const editorial = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Non-gesture fades. Springs are for things the user can touch.
 *
 * Durations are calibrated for a phone. Travel distances on a handset are short, so
 * the same curve that reads as crisp on a desktop reads as sluggish here — the
 * convergent guidance is that mobile runs 20–30% shorter than its desktop
 * equivalent, and these values already sit at that end.
 *
 * **Enter and exit are deliberately asymmetric.** An element arriving has to be
 * noticed, so it takes `base` (220ms). An element leaving has already been
 * dismissed by the user, and making them wait to watch it go reads as sluggish, so
 * it takes `exit` (140ms). Symmetric timings are the most common motion smell in an
 * app that has any motion at all.
 */
export const timings = {
  fast: { duration: 140, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  base: { duration: 220, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
  slow: { duration: 320, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
  /** Arrivals that should feel composed — a hero, a card, a first paint. */
  enter: { duration: 260, easing: editorial } satisfies WithTimingConfig,
  /**
   * Departures. Shorter than every entrance on purpose: the user has already
   * chosen to dismiss, so the exit only needs to read as decisive.
   */
  exit: { duration: 140, easing: Easing.in(Easing.quad) } satisfies WithTimingConfig,
  /** Ambient float for decorative elements — a gentle sine bob, never a spring. */
  float: { duration: 2600, easing: Easing.inOut(Easing.sin) } satisfies WithTimingConfig,
};

/**
 * Stagger step for a list arriving at once.
 *
 * Small on purpose. The whole run has to finish inside a single perceived beat — at
 * 40ms a six-row list completes its last entrance 200ms after the first, which
 * reads as one gesture. Push it to 80ms and the same list takes half a second and
 * starts to read as a queue the user is waiting on.
 */
export const STAGGER_STEP = 40;

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
