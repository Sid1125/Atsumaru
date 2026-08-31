import Svg, { Circle, Path } from "react-native-svg";

/**
 * Atsumaru vector icons — one consistent, stroke-based vocabulary for UI
 * chrome (nav, states, celebration), so surfaces never ride on a pile of
 * platform emoji. Each glyph is drawn in a 24×24 viewBox and inherits the
 * caller's colour. Icons are decorative chrome; the surrounding label always
 * carries meaning (docs/DESIGN.md §10).
 *
 * Category marks (🍜 🎮 🎨 ⛰…) deliberately stay emoji: they are compact,
 * data-encoded tags with a text label, not chrome.
 */
interface IconProps {
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
