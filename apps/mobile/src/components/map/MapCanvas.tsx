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
export const MapCanvas = memo(function MapCanvas() {
  return (
    <Svg width={WORLD} height={WORLD} viewBox={`0 0 ${WORLD} ${WORLD}`}>
      <Defs>
        <LinearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F7F1E8" />
          <Stop offset="1" stopColor="#F1E9DC" />
        </LinearGradient>
        <LinearGradient id="water" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#CFE0E6" />
          <Stop offset="1" stopColor="#BCD3DC" />
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
            fill="#EDE3D4"
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
        <Path d={PARK} fill="#DCE7D5" />
        <Path d={PARK} fill="none" stroke="#CBD9C2" strokeWidth={2} />
        <Path d={PLAZA} fill="#DCE7D5" />
        <Path d={PLAZA} fill="none" stroke="#CBD9C2" strokeWidth={2} />
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
              stroke="#E3D8C6"
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
              stroke="#FAF5EC"
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
              stroke="#DFD1BA"
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
              stroke="#FFFCF6"
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
              stroke="#D9C7AB"
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
              stroke="#FFFDF8"
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
        stroke="#B9AA95"
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
      <Path
        d={RAIL}
        stroke="#FFFDF8"
        strokeWidth={3}
        strokeDasharray="12 10"
        strokeLinecap="round"
        fill="none"
      />

      {/* The scramble crossing — the one landmark worth drawing explicitly */}
      <G>
        <Circle cx={700} cy={665} r={26} fill="#FFFDF8" />
        <Circle
          cx={700}
          cy={665}
          r={26}
          fill="none"
          stroke="#D9C7AB"
          strokeWidth={3}
        />
        <Circle cx={700} cy={665} r={7} fill="#C9B79B" />
      </G>

      {/* Labels last so nothing paints over them */}
      <G>
        {LABELS.map((label) => (
          <SvgText
            key={label.text}
            x={label.x}
            y={label.y}
            fill={label.size === "district" ? "#94836C" : "#A2937E"}
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
