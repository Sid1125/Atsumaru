import { memo } from "react";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import {
  blocks,
  LABELS,
  PARK,
  PLAZA,
  RAIL,
  RIVER,
  streets,
  WORLD,
} from "./geo";

/**
 * The static artwork. Rendered once and never re-rendered while the user pans:
 * the gesture layer transforms the *container*, which keeps the interaction on
 * the compositor instead of re-rasterising several hundred vector paths a frame.
 *
 * Palette is deliberately low-contrast — a map is a backdrop for the pins, so it
 * has to be detailed without competing for attention (skill §16, Simplicity).
 */

/**
 * The city's own palette, gathered rather than inlined across twenty `fill=`
 * attributes.
 *
 * These are illustration values, not semantic tokens: cartography needs a ramp of
 * near-identical warm greys that no interface role would ever ask for, and naming
 * each one `surfaceQuaternary` would be a fiction. What matters is that the whole
 * ramp is derived from Champagne Glow, so the city is the *page ground with
 * streets drawn on it* rather than a differently-coloured rectangle sitting in the
 * middle of the app.
 *
 * `water` stays blue — warmed and desaturated so it does not fight the citrus
 * world, but a warm-orange river would stop reading as water, and legibility of a
 * map feature outranks palette purity.
 */
const CITY = {
  groundFrom: "#F5E5CC",
  groundTo: "#EDDBBD",
  waterFrom: "#BFD4D2",
  waterTo: "#A9C2C0",
  block: "#EBD9BC",
  park: "#D9DEB9",
  parkEdge: "#C4CBA1",
  /** Streets are drawn casing-then-fill, so each width has a dark/light pair. */
  minor: "#E0CFB0",
  minorFill: "#F9EFDC",
  secondary: "#D6C3A2",
  secondaryFill: "#FDF6E8",
  primary: "#C7B08A",
  primaryFill: "#FFFBF2",
  rail: "#A8927A",
  railTie: "#FFFBF2",
  stationFill: "#FFFBF2",
  stationCore: "#A8927A",
  labelDistrict: "#6B6053",
  label: "#867A67",
} as const;
export const MapCanvas = memo(function MapCanvas() {
  return (
    <Svg width={WORLD} height={WORLD} viewBox={`0 0 ${WORLD} ${WORLD}`}>
      <Defs>
        <LinearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={CITY.groundFrom} />
          <Stop offset="1" stopColor={CITY.groundTo} />
        </LinearGradient>
        <LinearGradient id="water" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={CITY.waterFrom} />
          <Stop offset="1" stopColor={CITY.waterTo} />
        </LinearGradient>
      </Defs>

      {/* Ground */}
      <Rect x={0} y={0} width={WORLD} height={WORLD} fill="url(#ground)" />

      {/* City blocks — faint masses so streets read as gaps between buildings */}
      <G opacity={0.5}>
        {blocks.map((block, index) => (
          <Rect
            key={index}
            x={block.x}
            y={block.y}
            width={block.w}
            height={block.h}
            rx={3}
            fill={CITY.block}
          />
        ))}
      </G>

      {/* Water sits under the roads it passes beneath */}
      <Path
        d={RIVER}
        stroke="url(#water)"
        strokeWidth={26}
        strokeLinecap="round"
        fill="none"
      />

      {/* Green space */}
      <G>
        <Path d={PARK} fill={CITY.park} />
        <Path d={PARK} fill="none" stroke={CITY.parkEdge} strokeWidth={2} />
        <Path d={PLAZA} fill={CITY.park} />
        <Path d={PLAZA} fill="none" stroke={CITY.parkEdge} strokeWidth={2} />
      </G>

      {/* Streets, painted back-to-front so arterials sit on top of side roads.
          Each rank gets a casing stroke plus a lighter fill stroke — that pair is
          what makes vector roads read as roads rather than lines. */}
      <G>
        {streets
          .filter((s) => s.rank === 2)
          .map((street, index) => (
            <Path
              key={`r2-${index}`}
              d={street.d}
              stroke={CITY.minor}
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        {streets
          .filter((s) => s.rank === 2)
          .map((street, index) => (
            <Path
              key={`r2f-${index}`}
              d={street.d}
              stroke={CITY.minorFill}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
          ))}
      </G>

      <G>
        {streets
          .filter((s) => s.rank === 1)
          .map((street, index) => (
            <Path
              key={`r1-${index}`}
              d={street.d}
              stroke={CITY.secondary}
              strokeWidth={11}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        {streets
          .filter((s) => s.rank === 1)
          .map((street, index) => (
            <Path
              key={`r1f-${index}`}
              d={street.d}
              stroke={CITY.secondaryFill}
              strokeWidth={7.5}
              strokeLinecap="round"
              fill="none"
            />
          ))}
      </G>

      <G>
        {streets
          .filter((s) => s.rank === 0)
          .map((street, index) => (
            <Path
              key={`r0-${index}`}
              d={street.d}
              stroke={CITY.primary}
              strokeWidth={20}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        {streets
          .filter((s) => s.rank === 0)
          .map((street, index) => (
            <Path
              key={`r0f-${index}`}
              d={street.d}
              stroke={CITY.primaryFill}
              strokeWidth={14}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
      </G>

      {/* Rail corridor — dashed, above the roads it crosses */}
      <Path
        d={RAIL}
        stroke={CITY.rail}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
      <Path
        d={RAIL}
        stroke={CITY.primaryFill}
        strokeWidth={3}
        strokeDasharray="12 10"
        strokeLinecap="round"
        fill="none"
      />

      {/* The scramble crossing — the one landmark worth drawing explicitly */}
      <G>
        <Circle cx={700} cy={665} r={26} fill={CITY.stationFill} />
        <Circle
          cx={700}
          cy={665}
          r={26}
          fill="none"
          stroke={CITY.primary}
          strokeWidth={3}
        />
        <Circle cx={700} cy={665} r={7} fill={CITY.stationCore} />
      </G>

      {/* Labels last so nothing paints over them */}
      <G>
        {LABELS.map((label) => (
          <SvgText
            key={label.text}
            x={label.x}
            y={label.y}
            fill={label.size === "district" ? CITY.labelDistrict : CITY.label}
            fontSize={
              label.size === "district" ? 27 : label.size === "area" ? 18 : 14
            }
            fontWeight={label.size === "district" ? "700" : "500"}
            letterSpacing={label.size === "district" ? 5 : 1.2}
            textAnchor="middle"
            opacity={label.size === "feature" ? 0.75 : 0.95}
          >
            {label.text}
          </SvgText>
        ))}
      </G>
    </Svg>
  );
});
