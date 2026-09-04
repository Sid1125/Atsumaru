import Svg, { Circle, Path } from "react-native-svg";

/**
 * Atsumaru vector icons — one consistent, stroke-based vocabulary for UI
 * chrome (nav, states, celebration, categories, ratings), so surfaces never
 * ride on a pile of platform emoji. Each glyph is drawn in a 24×24 viewBox
 * and inherits the caller's colour. Icons are decorative chrome; the
 * surrounding label always carries meaning (docs/DESIGN.md §10).
 */
export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Base({
  size = 24,
  color = "currentColor",
  strokeWidth = 1.6,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
    >
      {children}
    </Svg>
  );
}

/** Two people — one connection is the point of the app. */
export function IconConnections(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="9" cy="8" r="3.2" />
      <Path d="M3.2 20a5.8 5.8 0 0 1 11.6 0" />
      <Circle cx="16.6" cy="8" r="3.2" />
      <Path d="M12.8 17.4a4.8 4.8 0 0 1 8 0" />
    </Base>
  );
}

/** A single profile — head + shoulders. */
export function IconProfile(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </Base>
  );
}

/** Settings — a gear with teeth, distinct from profile. */
export function IconGear(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="3.1" />
      <Path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </Base>
  );
}

/** A right chevron for disclosure rows. */
export function IconChevronRight(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M9 6l6 6-6 6" />
    </Base>
  );
}

/** Celebration sparkle — the mutual-match payoff. */
export function IconSparkle(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M12 3l2.2 6.8 6.8 2.2-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z" />
    </Base>
  );
}

/** Empty state — a map pin, warm and open. */
export function IconMap(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M12 21.5S5 16.1 5 10.4a7 7 0 0 1 14 0C19 16.1 12 21.5 12 21.5z" />
      <Circle cx="12" cy="10" r="2.3" />
    </Base>
  );
}

/**
 * Recentre the map on me — a crosshair, the near-universal glyph for it. Deliberately not
 * the pin above: a pin marks a place, a crosshair asks to be taken somewhere.
 */
export function IconLocate(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="6.2" />
      <Circle cx="12" cy="12" r="1.6" />
      <Path d="M12 2.4v2.6M12 19v2.6M2.4 12h2.6M19 12h2.6" />
    </Base>
  );
}

/** Place search — a magnifier. */
export function IconSearch(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="11" cy="11" r="6.4" />
      <Path d="M15.8 15.8 21 21" />
    </Base>
  );
}

/** Error — a warning triangle, not a pouting face. */
export function IconWarning(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M12 3l9.5 16.5h-19z" />
      <Path d="M12 10v4.2" />
      <Path d="M12 17.2h.01" />
    </Base>
  );
}

/** Send — paper plane for the chat composer. */
export function IconSend(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M3 11.5 21 3l-8.3 18-2.2-7.5z" />
      <Path d="M10.5 13.5 21 3" />
    </Base>
  );
}

/** Globe — a language/locale marker. */
export function IconGlobe(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M3.5 12h17" />
      <Path d="M12 3.5c2.6 2.3 4 5.2 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.2-4-8.5s1.4-6.2 4-8.5z" />
    </Base>
  );
}

/** Close — a compact × for removable chips and modal dismiss. */
export function IconClose(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}

/** Camera — the change-photo affordance on the profile. */
export function IconCamera(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M4 8.5h3l1.6-2.3h6.8L17 8.5h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <Circle cx="12" cy="13" r="3.4" />
    </Base>
  );
}

/** Email — an envelope for the email sign-in surface. */
export function IconMail(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M3 6.5h18v11H3z" />
      <Path d="m3 7.5 9 6.5 9-6.5" />
    </Base>
  );
}

/* ------------------------------------------------------------------ */
/* Category marks — data-encoded, always paired with the category label. */
/* ------------------------------------------------------------------ */

/** Food — a steaming noodle bowl. */
export function IconFood(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M3.5 10.5h17" />
      <Path d="M5 10.5a7 7 0 0 0 14 0" />
      <Path d="M12 4.5v3" />
      <Path d="M8.2 5.5v1.6" />
      <Path d="M15.8 5.5v1.6" />
    </Base>
  );
}

/** Gaming — a gamepad with d-pad and face buttons. */
export function IconGaming(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M7.5 8.5h9a4.5 4.5 0 0 1 4.5 4.5v1.5a2.8 2.8 0 0 1-5 1.8l-1.2-1.5H9.2L8 16.3a2.8 2.8 0 0 1-5-1.8V13a4.5 4.5 0 0 1 4.5-4.5z" />
      <Path d="M9 11.2v3M7.5 12.7h3" />
      <Circle cx="16.2" cy="11.5" r=".7" />
      <Circle cx="18.4" cy="13" r=".7" />
    </Base>
  );
}

/** Arts — a painter's palette with paint dots. */
export function IconArts(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 2-.9 2-1.9 0-.7-.5-1.2-.5-1.9 0-1 .9-1.7 2.1-1.7H17a4 4 0 0 0 4-4c0-4.6-4-7.5-9-7.5z" />
      <Circle cx="7.6" cy="12.4" r=".8" />
      <Circle cx="10.6" cy="7.9" r=".8" />
      <Circle cx="15.6" cy="7.9" r=".8" />
      <Circle cx="17.6" cy="11.9" r=".8" />
    </Base>
  );
}

/** Outdoor — peaks under a sun. */
export function IconOutdoor(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="m3 19 6.5-11L13 13.5l2.5-3.5L21 19z" />
      <Circle cx="6.8" cy="7" r="1.7" />
    </Base>
  );
}

/** Music — a note on a staff. */
export function IconMusic(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M9.5 17.5V6l10-1.8v11.8" />
      <Circle cx="6.8" cy="17.5" r="2.7" />
      <Circle cx="16.8" cy="16" r="2.7" />
    </Base>
  );
}

/** Wellness — a leaf. */
export function IconWellness(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M11 19.5A7 7 0 0 1 9.8 5.6C15.5 4.5 17 4 19 1.5c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z" />
      <Path d="M2.5 21c0-3 1.8-5.4 5-6" />
    </Base>
  );
}

/** Travel — a compass. */
export function IconTravel(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4z" />
    </Base>
  );
}

/** Learning — an open book. */
export function IconLearning(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M12 6.5C10.4 5 7.8 4.5 4.5 5.2v12.8c3.3-.7 5.9-.2 7.5 1.3 1.6-1.5 4.2-2 7.5-1.3V5.2C16.2 4.5 13.6 5 12 6.5z" />
      <Path d="M12 6.5v12.8" />
    </Base>
  );
}

/** Sports — a dumbbell. */
export function IconSports(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M4.8 9v6M2.8 10.4v3.2M19.2 9v6M21.2 10.4v3.2M4.8 12h14.4" />
    </Base>
  );
}

/* ------------------------------------------------------------ */
/* Rating marks — the post-meetup feedback register.             */
/* ------------------------------------------------------------ */

/** Meh — a flat-mouth face. */
export function IconFaceMeh(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="M8.2 15.5h7.6" />
      <Circle cx="9" cy="9.8" r=".7" />
      <Circle cx="15" cy="9.8" r=".7" />
    </Base>
  );
}

/** Good — a smiling face. */
export function IconFaceGood(props: IconProps) {
  return (
    <Base {...props}>
      <Circle cx="12" cy="12" r="8.5" />
      <Path d="m8.5 13.5 2.3 2.2 4.7-4.6" />
      <Circle cx="9" cy="9.8" r=".7" />
      <Circle cx="15" cy="9.8" r=".7" />
    </Base>
  );
}

/** Fire — a flame for the top rating. */
export function IconFire(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Base>
  );
}

/** Wave — an open greeting hand for empty chat states. */
export function IconWave(props: IconProps) {
  return (
    <Base {...props}>
      <Path d="M7.5 12.5V6a1.6 1.6 0 0 1 3.2 0v5.8" />
      <Path d="M10.7 11.6V4.6a1.6 1.6 0 0 1 3.2 0v7.5" />
      <Path d="M13.9 11.4V6.2a1.6 1.6 0 0 1 3.2 0v6.2" />
      <Path d="M17.1 11.4V8.4a1.6 1.6 0 0 1 3.2 0v4.2" />
      <Path d="M20.3 12.7c-1.6 4-4.4 6-7.6 6-4 0-6.6-2.4-8.2-5.5-.3-.06-.6-.3-.7-.8-.3-1.4-.4-2.4-.4-2.4" />
    </Base>
  );
}
