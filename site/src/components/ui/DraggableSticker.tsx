"use client";

import { useRef } from "react";
import { sound } from "@/lib/sound";

const TONE_CLASS = {
  neon: "",
  lilac: "sticker-lilac",
  pink: "sticker-pink",
  cyan: "sticker-cyan",
  vermilion: "sticker-vermilion",
  ink: "sticker-ink",
} as const;

export type StickerTone = keyof typeof TONE_CLASS;

interface Props {
  text: string;
  tone?: StickerTone;
  /** Resting rotation in degrees. */
  tilt?: number;
  className?: string;
}

const MAX_DRAG = 150;
const clamp = (value: number) => Math.max(-MAX_DRAG, Math.min(MAX_DRAG, value));

/**
 * A vinyl sticker you can grab, drag and toss. On release it flings with the pointer's
 * momentum and springs back home, so a played-with page never ends up with labels
 * covering the copy.
 *
 * Decorative: every claim printed here is also real text elsewhere on the page, so the
 * sticker is hidden from assistive tech instead of becoming an undraggable tab stop.
 */
export function DraggableSticker({ text, tone = "neon", tilt = 0, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startY: 0, x: 0, y: 0, vx: 0, vy: 0 });

  const paint = (x: number, y: number, spin: number) => {
    const el = ref.current;
    if (!el) return;

    el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt + spin}deg)`;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;

    el.setPointerCapture(event.pointerId);
    el.style.transition = "none";
    el.style.animation = "none";

    drag.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state.active) return;

    const x = clamp(event.clientX - state.startX);
    const y = clamp(event.clientY - state.startY);

    state.vx = x - state.x;
    state.vy = y - state.y;
    state.x = x;
    state.y = y;

    paint(x, y, x * 0.06);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const state = drag.current;
    if (!el || !state.active) return;

    state.active = false;
    el.releasePointerCapture(event.pointerId);

    const moved = Math.hypot(state.x, state.y);

    // A tap, not a drag: just pop and let it sit.
    if (moved < 4) {
      sound.pop(560);
      el.style.transition = "transform 0.45s cubic-bezier(0.34, 1.8, 0.64, 1)";
      paint(0, 0, 0);
      return;
    }

    // Toss: carry the release velocity a little further, then spring home.
    const flungX = clamp(state.x + state.vx * 6);
    const flungY = clamp(state.y + state.vy * 6);

    el.style.transition = "transform 0.18s cubic-bezier(0.2, 0.8, 0.4, 1)";
    paint(flungX, flungY, flungX * 0.08);

    window.setTimeout(() => {
      if (drag.current.active) return;

      el.style.transition = "transform 0.7s cubic-bezier(0.34, 1.45, 0.5, 1)";
      paint(0, 0, 0);
    }, 190);
  };

  return (
    <div
      ref={ref}
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ transform: `rotate(${tilt}deg)` }}
      className={`sticker-drag sticker-badge ${TONE_CLASS[tone]} ${className}`}
    >
      {text}
    </div>
  );
}
