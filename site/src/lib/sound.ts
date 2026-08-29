"use client";

/**
 * Tiny Web Audio synth for tactile UI micro-feedback — no audio files, no library.
 *
 * Sound is **opt-in**: nothing plays until the visitor flips the SFX switch, and the
 * choice is remembered. Browsers also require a user gesture before audio starts, so
 * every call happens inside a click handler.
 */

const STORAGE_KEY = "atsumaru.sfx";

type Listener = (enabled: boolean) => void;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private listeners = new Set<Listener>();

  /** Reads the remembered preference; safe to call during hydration. */
  hydrate() {
    if (typeof window === "undefined") return;

    this.setEnabled(window.localStorage.getItem(STORAGE_KEY) === "on", false);
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(next: boolean, persist = true) {
    this.enabled = next;

    if (persist && typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    }

    for (const listener of this.listeners) listener(next);
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === "suspended") void this.ctx.resume();

    return this.ctx;
  }

  /** Envelope helper: every effect here is one oscillator and one gain ramp. */
  private blip(
    type: OscillatorType,
    from: number,
    to: number,
    peak: number,
    seconds: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = type;
      osc.frequency.setValueAtTime(from, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), now + seconds);

      gain.gain.setValueAtTime(peak, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + seconds + 0.01);
    } catch {
      // Autoplay policy or a closed context — never let UI feedback throw.
    }
  }

  /** Soft bubble pop for pills and toggles. */
  pop(freq = 520) {
    this.blip("sine", freq, freq * 0.45, 0.1, 0.09);
  }

  /** Wooden hanko-stamp thud for a completed action. */
  stamp() {
    this.blip("triangle", 150, 42, 0.22, 0.14);
  }

  /** Short rising sparkle for the mutual-match moment. */
  chime() {
    this.blip("sine", 660, 1180, 0.08, 0.18);
  }
}

export const sound = new SoundEngine();
