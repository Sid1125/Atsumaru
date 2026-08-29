/**
 * Theme entry point. Screens import from here, never from the individual files,
 * so the token surface stays one import and one place to audit.
 */

export {
  colors,
  palette,
  spacing,
  radius,
  elevation,
  HIT_SLOP,
  MIN_TARGET,
} from "./tokens";

export { type, sectionHeader, typography } from "./typography";

export {
  springs,
  spring,
  timings,
  projectDecay,
  rubberband,
  nearestSnap,
  useReducedMotion,
} from "./motion";
