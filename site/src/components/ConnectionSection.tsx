"use client";

import { useState } from "react";
import { Palette, Gamepad2, Soup, PartyPopper, MessageCircle } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Highlight } from "@/components/ui/Highlight";

const members = [
  { handle: "@haru", icon: Palette, color: "#8B5E3C", label: "Art lover" },
  { handle: "@kenji", icon: Gamepad2, color: "#7A9E7E", label: "Board games" },
  { handle: "@yuki", icon: Soup, color: "#F08A5D", label: "Foodie" },
];

const stageKeys = ["select", "mutual", "unlock"] as const;
type Stage = (typeof stageKeys)[number];

export function ConnectionSection() {
  const [stage, setStage] = useState<Stage>("select");

  return (
    <section className="py-24 md:py-32 bg-bg relative overflow-hidden ambient-surface">
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Copy */}
          <div>
            <Reveal>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text leading-[0.95]">
                Connection comes after the <Highlight>meetup</Highlight>.
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-8 space-y-2">
                <p className="text-xl md:text-2xl font-bold text-text">No unsolicited DMs.</p>
                <p className="text-xl md:text-2xl font-bold text-text">No public rejection.</p>
                <p className="text-xl md:text-2xl font-bold text-accent">No pressure.</p>
              </div>
            </Reveal>
            <Reveal delay={0.3}>
              <p className="mt-8 text-base text-text-muted leading-relaxed max-w-md">
                Only mutual interest unlocks private conversation.
                Your choices stay strictly between you and the system.
              </p>
            </Reveal>
          </div>

          {/* Right: Interactive demo */}
          <Reveal from="right">
            <div className="bg-white rounded-3xl p-8 md:p-10 border border-border shadow-2xl shadow-black/5">
              {/* Stage indicator */}
              <div className="flex items-center justify-center gap-3 mb-8" role="tablist" aria-label="Connection steps">
                {stageKeys.map((s, i) => (
                  <div key={s} className="flex items-center gap-3">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={stage === s}
                      onClick={() => setStage(s)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 cursor-pointer ${
                        stage === s ? "bg-accent-strong text-white scale-110 shadow-lg shadow-accent/30" :
                        i < stageKeys.indexOf(stage) ? "bg-sage text-white" : "bg-bg-dark/10 text-text-muted hover:bg-bg-dark/20"
                      }`}
                    >
                      {i < stageKeys.indexOf(stage) ? "✓" : i + 1}
                    </button>
                    {i < 2 && (
                      <div className={`w-12 h-0.5 transition-colors duration-300 ${
                        i < stageKeys.indexOf(stage) ? "bg-sage" : "bg-border"
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Stage content */}
              <div className="min-h-[320px] flex flex-col justify-center">
                {/* Select */}
                {stage === "select" && (
                  <div className="text-center">
                    <p className="text-lg font-semibold text-text mb-6">Who would you like to stay connected with?</p>
                    <div className="space-y-3 max-w-sm mx-auto">
                      {members.map((m) => (
                        <button
                          key={m.handle}
                          type="button"
                          onClick={() => setStage("mutual")}
                          className="w-full flex items-center justify-between p-4 rounded-xl border border-border hover:border-accent/30 hover:bg-accent-light/30 transition-all duration-200 cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center group-hover:scale-110 transition-transform" style={{ color: m.color }}>
                              <m.icon size={20} aria-hidden="true" />
                            </span>
                            <div className="text-left">
                              <p className="text-sm font-bold text-text">{m.handle}</p>
                              <p className="text-[11px] text-text-muted">{m.label}</p>
                            </div>
                          </div>
                          <div className="w-6 h-6 rounded-full border-2 border-accent bg-accent flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-text-muted italic">Your choices are private.</p>
                  </div>
                )}

                {/* Mutual */}
                {stage === "mutual" && (
                  <div className="text-center">
                    <div className="text-5xl mb-4 flex justify-center">
                      <PartyPopper size={42} color="#E8634D" aria-hidden="true" />
                    </div>
                    <p className="text-xl font-bold text-text mb-2">It&apos;s a mutual connection!</p>
                    <p className="text-sm text-text-muted mb-1">You picked @haru</p>
                    <p className="text-sm text-text-muted mb-6">@haru picked you</p>
                    <button
                      type="button"
                      onClick={() => setStage("unlock")}
                      className="h-12 px-8 text-sm font-semibold rounded-full bg-accent-strong text-white hover:bg-accent-strong/90 transition-all duration-200 cursor-pointer inline-flex items-center gap-2 shadow-lg shadow-accent/20"
                    >
                      Start chatting
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 8h10m0 0l-4-4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Unlock */}
                {stage === "unlock" && (
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-sage-light flex items-center justify-center mx-auto mb-4">
                      <MessageCircle size={28} color="#5D8A66" aria-hidden="true" />
                    </div>
                    <p className="text-xl font-bold text-text mb-2">1:1 chat unlocked</p>
                    <p className="text-sm text-text-muted mb-6">Your private conversation with @haru is ready.</p>
                    <div className="bg-bg rounded-xl p-4 border border-border max-w-sm mx-auto">
                      <div className="flex items-center gap-3 text-left">
                        <span className="w-10 h-10 rounded-full bg-bg-dark/5 flex items-center justify-center">
                          <Palette size={20} color="#8B5E3C" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-text">@haru</p>
                          <p className="text-xs text-text-muted">
                            Hey! Loved the art walk too{" "}
                            <Palette size={11} className="inline-block align-[-1px]" color="#8B5E3C" aria-hidden="true" />
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStage("select")}
                      className="mt-4 text-xs text-text-muted hover:text-text cursor-pointer transition-colors"
                    >
                      ↺ Reset demo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

