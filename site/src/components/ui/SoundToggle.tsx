"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { sound } from "@/lib/sound";

const subscribe = (onChange: () => void) => {
  const unsubscribe = sound.subscribe(onChange);

  return () => {
    unsubscribe();
  };
};

/**
 * Opt-in switch for the UI sound effects. Audio never plays before this is on, which
 * keeps the page quiet by default and respects visitors on shared or open-plan setups.
 */
export function SoundToggle({ className = "" }: { className?: string }) {
  // The engine is the source of truth, so the toggle stays in step with every instance
  // of it (desktop nav + mobile menu) without duplicating state.
  const enabled = useSyncExternalStore(
    subscribe,
    () => sound.isEnabled(),
    () => false
  );

  useEffect(() => {
    sound.hydrate();
  }, []);

  const toggle = () => {
    const next = !sound.isEnabled();

    sound.setEnabled(next);
    // Play the confirmation *after* enabling, so the switch demonstrates itself.
    if (next) sound.pop(700);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? "Turn sound effects off" : "Turn sound effects on"}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors duration-200 cursor-pointer ${
        enabled
          ? "border-neon/60 bg-neon/15 text-neon"
          : "border-white/20 text-text-muted-light hover:border-white/45 hover:text-text-light"
      } ${className}`}
    >
      {enabled ? (
        <Volume2 size={13} aria-hidden="true" />
      ) : (
        <VolumeX size={13} aria-hidden="true" />
      )}
      <span>sfx</span>
      <span className="sr-only">{enabled ? "on" : "off"}</span>
    </button>
  );
}
