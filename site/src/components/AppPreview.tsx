"use client";

import { Reveal } from "@/components/ui/Reveal";
import { PHOTOS } from "@/lib/constants";

function OnboardingScreen() {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 pt-12">
        <p className="text-xs font-bold text-text">Let&apos;s get to know you.</p>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-2.5 px-4 pb-3">
        <div className="bg-bg-dark rounded-2xl rounded-bl-sm p-3.5 max-w-[85%]">
          <p className="text-[11px] text-text-light">What do you usually do on weekends?</p>
        </div>
        <div className="bg-accent rounded-2xl rounded-br-sm p-3.5 max-w-[85%] self-end">
          <p className="text-[11px] text-white">I hike, try cafés, and play board games.</p>
        </div>
        <div className="bg-bg-dark rounded-2xl rounded-bl-sm p-3.5 max-w-[85%]">
          <p className="text-[11px] text-text-light">Nice! Anything else you enjoy?</p>
        </div>
        <div className="bg-accent rounded-2xl rounded-br-sm p-3.5 max-w-[85%] self-end">
          <p className="text-[11px] text-white">Sometimes photography walks too.</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="h-10 rounded-full bg-bg-dark/5 border border-border flex items-center px-4">
          <span className="text-[10px] text-text-muted">Type a message...</span>
        </div>
      </div>
    </div>
  );
}

function DiscoverScreen() {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 pt-12">
        <p className="text-[10px] font-medium text-text-muted">@trailbrew</p>
        <p className="text-xs font-bold text-text mt-0.5">Find your people nearby</p>
      </div>
      <div className="mt-3 mx-3 rounded-2xl h-44 relative overflow-hidden border border-border-light">
        <img src={PHOTOS.tokyo} alt="" className="w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/50 to-transparent" />
        {[{ top: "28%", left: "32%" }, { top: "48%", left: "58%" }, { top: "52%", left: "22%" }, { top: "68%", left: "48%" }].map((pos, i) => (
          <div key={i} className="absolute w-3 h-3 bg-accent rounded-full shadow-md ring-2 ring-white" style={{ top: pos.top, left: pos.left }} />
        ))}
      </div>
      <div className="px-3 py-2.5 flex gap-1.5 overflow-hidden">
        {["Food", "Games", "Art", "Outdoor"].map((c) => (
          <span key={c} className="text-[9px] px-2.5 py-1 rounded-full bg-bg-dark/5 border border-border whitespace-nowrap font-medium">{c}</span>
        ))}
      </div>
      <div className="px-3 pb-3">
        <div className="bg-white rounded-xl p-3 border border-border shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🍜</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-text truncate">Ramen & Retro Games</p>
              <p className="text-[9px] text-text-muted">Shibuya · Sat 7 PM</p>
            </div>
            <span className="text-[10px] font-bold text-accent">91%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MeetupScreen() {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 pt-12">
        <p className="text-xs font-bold text-text">Ramen & Retro Games</p>
        <p className="text-[10px] text-text-muted">Shibuya · Sat 7:00 PM</p>
      </div>
      <div className="px-4 mt-4">
        <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2">Your group · 5/6</p>
        <div className="flex flex-wrap gap-1.5">
          {["@haru", "@kenji", "@yuki", "@mika"].map((h) => (
            <span key={h} className="text-[10px] px-2.5 py-1 rounded-full bg-bg-dark/5 border border-border font-medium">{h}</span>
          ))}
        </div>
      </div>
      <div className="px-4 mt-4">
        <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2">Why this group?</p>
        <div className="flex flex-wrap gap-1.5">
          {["🍜 Ramen", "🎮 Gaming", "☕ Café"].map((r) => (
            <span key={r} className="text-[9px] px-2.5 py-1 rounded-full bg-accent-light text-accent font-medium">{r}</span>
          ))}
        </div>
      </div>
      <div className="flex-1" />
      <div className="px-4 pb-3">
        <div className="h-11 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/20">
          <span className="text-xs font-bold">Join group</span>
        </div>
      </div>
    </div>
  );
}

const screens = [
  { label: "AI Onboarding", num: "01", component: OnboardingScreen },
  { label: "Discover", num: "02", component: DiscoverScreen },
  { label: "Meetup", num: "03", component: MeetupScreen },
];

export function AppPreview() {
  return (
    <section className="py-24 md:py-32 bg-bg relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <p className="text-sm font-medium tracking-widest uppercase text-accent mb-4">
            The experience
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text leading-[0.95]">
            Three screens.<br />One journey.
          </h2>
        </Reveal>

        <div className="mt-16 md:mt-24 flex flex-col md:flex-row items-end justify-center gap-8 md:gap-6">
          {screens.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.15}>
              <div className="text-center">
                <div className="phone-realistic mx-auto">
                  <div className="phone-realistic-screen">
                    <s.component />
                  </div>
                </div>
                <div className="mt-6">
                  <p className="text-xs font-bold text-accent mb-1">{s.num}</p>
                  <p className="text-sm font-semibold text-text">{s.label}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
