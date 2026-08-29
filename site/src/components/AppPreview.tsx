"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Highlight } from "@/components/ui/Highlight";
import { Footprints, Soup, Gamepad2, Coffee, Home, Compass, MessageCircle } from "lucide-react";
import { PHOTOS } from "@/lib/constants";
import { matchColor } from "@/lib/match";

function OnboardingScreen() {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 pt-12 flex items-center gap-2">
        <img src={PHOTOS.friends} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-accent" />
        <p className="text-xs font-bold text-text">Let&apos;s get to know you.</p>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-2.5 px-4 pb-3">
        <div className="flex items-end gap-1.5 max-w-[85%]">
          <img src={PHOTOS.hiking} alt="" className="w-4 h-4 rounded-full object-cover shrink-0 mb-1" />
          <div className="bg-bg-dark rounded-2xl rounded-bl-sm p-3.5">
            <p className="text-[11px] text-text-light">What do you usually do on weekends?</p>
          </div>
        </div>
        <div className="bg-accent-strong rounded-2xl rounded-br-sm p-3.5 max-w-[85%] self-end">
          <p className="text-[11px] text-white">I hike, try cafés, and play board games.</p>
        </div>
        <div className="flex items-end gap-1.5 max-w-[85%]">
          <img src={PHOTOS.hiking} alt="" className="w-4 h-4 rounded-full object-cover shrink-0 mb-1" />
          <div className="bg-bg-dark rounded-2xl rounded-bl-sm p-3.5">
            <p className="text-[11px] text-text-light">Nice! Anything else you enjoy?</p>
          </div>
        </div>
        <div className="flex items-end gap-1.5 max-w-[55%]">
          <img src={PHOTOS.hiking} alt="" className="w-4 h-4 rounded-full object-cover shrink-0 mb-1" />
          <div className="bg-bg-dark rounded-2xl rounded-bl-sm p-3.5">
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-accent typing-dot" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="h-10 rounded-full bg-bg-dark/5 border border-border flex items-center px-4 justify-between">
          <span className="text-[10px] text-text-muted">Type a message...</span>
          <MessageCircle size={13} className="text-accent" />
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
        <img src={PHOTOS.tokyo} alt="" className="w-full h-full object-cover opacity-70" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/50 to-transparent" />
        {[{ top: "28%", left: "32%" }, { top: "48%", left: "58%" }, { top: "52%", left: "22%" }, { top: "68%", left: "48%" }].map((pos, i) => (
          <div key={i} className="absolute w-3 h-3 bg-accent rounded-full shadow-md ring-2 ring-white" style={{ top: pos.top, left: pos.left }} />
        ))}
        <div className="absolute top-2 left-2 bg-white rounded-full px-2.5 py-1 text-[9px] font-bold text-text shadow-md">
          12 meetups nearby
        </div>
      </div>
      <div className="px-3 py-2.5 flex gap-1.5 overflow-hidden">
        {["Food", "Games", "Art", "Outdoor"].map((c) => (
          <span key={c} className="text-[9px] px-2.5 py-1 rounded-full bg-bg-dark/5 border border-border whitespace-nowrap font-medium">{c}</span>
        ))}
      </div>
      <div className="px-3 flex flex-col gap-2 flex-1 overflow-hidden">
        <div className="bg-white rounded-xl p-2.5 border border-border shadow-sm flex gap-2.5">
          <img src={PHOTOS.ramen} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Soup size={13} color="#F08A5D" className="shrink-0" />
              <p className="text-[10px] font-bold text-text truncate flex-1">Ramen & Retro Games</p>
              <span className="text-[10px] font-bold" style={{ color: matchColor(91) }}>91%</span>
            </div>
            <p className="text-[9px] text-text-muted">Shibuya · Sat 7 PM</p>
            <div className="mt-1 flex items-center gap-1">
              <div className="flex -space-x-1.5">
                {[PHOTOS.hiking, PHOTOS.cafe, PHOTOS.art].map((p, i) => (
                  <img key={i} src={p} alt="" className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-white" loading="lazy" decoding="async" />
                ))}
              </div>
              <span className="text-[8px] text-text-muted">5/6 going</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-2.5 border border-border shadow-sm flex gap-2.5">
          <img src={PHOTOS.hiking} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Footprints size={13} color="#B98A2E" className="shrink-0" />
              <p className="text-[10px] font-bold text-text truncate flex-1">Weekend Hike</p>
              <span className="text-[10px] font-bold" style={{ color: matchColor(95) }}>95%</span>
            </div>
            <p className="text-[9px] text-text-muted">Mt. Takao · Sun 9 AM</p>
            <div className="mt-1 flex items-center gap-1">
              <div className="flex -space-x-1.5">
                {[PHOTOS.friends, PHOTOS.music, PHOTOS.photo].map((p, i) => (
                  <img key={i} src={p} alt="" className="w-3.5 h-3.5 rounded-full object-cover ring-1 ring-white" loading="lazy" decoding="async" />
                ))}
              </div>
              <span className="text-[8px] text-text-muted">6/8 going</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-border-light">
        <div className="flex items-center justify-around">
          {[{ I: Home, active: true }, { I: Compass, active: false }, { I: MessageCircle, active: false }].map(({ I, active }, i) => (
            <div key={i} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: active ? "#FFF0ED" : "transparent" }}>
              <I size={14} color={active ? "#E8634D" : "#B9B2AB"} strokeWidth={active ? 2.4 : 2} />
            </div>
          ))}
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
          {[{ icon: Soup, color: "#F08A5D", label: "Ramen" }, { icon: Gamepad2, color: "#7A9E7E", label: "Gaming" }, { icon: Coffee, color: "#8B5E3C", label: "Café" }].map((r) => (
            <span key={r.label} className="text-[9px] px-2.5 py-1 rounded-full bg-accent-light text-accent font-medium inline-flex items-center gap-1">
              <r.icon size={10} style={{ color: r.color }} />
              {r.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex-1" />
      <div className="px-4 pb-3">
        <div className="h-11 rounded-full bg-accent-strong text-white flex items-center justify-center shadow-lg shadow-accent/20">
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
    <section className="py-24 md:py-32 bg-bg relative overflow-hidden ambient-surface">
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text leading-[0.95]">
            Three screens.<br />One <Highlight>journey</Highlight>.
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
