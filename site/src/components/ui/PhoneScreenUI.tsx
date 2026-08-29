"use client";

import { Soup, Gamepad2, Footprints, Home, Compass, Users, MessageCircle, Coffee } from "lucide-react";
import { PHOTOS } from "@/lib/constants";

function Avatar({ src, size = "h-5 w-5" }: { src: string; size?: string }) {
  return (
    <img
      src={src}
      alt=""
      className={`${size} rounded-full object-cover shrink-0 ring-[1.5px] ring-white`}
      loading="lazy"
      decoding="async"
    />
  );
}

const CARDS = [
  {
    icon: Soup,
    iconColor: "#F08A5D",
    title: "Ramen & Retro Games",
    meta: "Shibuya · Sat 7 PM",
    fit: "91%",
    fitColor: "#E8634D",
    thumb: PHOTOS.ramen,
    avatars: [PHOTOS.hiking, PHOTOS.cafe, PHOTOS.art, PHOTOS.music],
    slots: "5/6",
  },
  {
    icon: Gamepad2,
    iconColor: "#7A9E7E",
    title: "Board Game Night",
    meta: "Daikanyama · Fri 8 PM",
    fit: "87%",
    fitColor: "#7A9E7E",
    thumb: PHOTOS.gaming,
    avatars: [PHOTOS.cafe, PHOTOS.art, PHOTOS.friends],
    slots: "4/5",
  },
  {
    icon: Footprints,
    iconColor: "#B98A2E",
    title: "Weekend Hike",
    meta: "Mt. Takao · Sun 9 AM",
    fit: "95%",
    fitColor: "#B98A2E",
    thumb: PHOTOS.hiking,
    avatars: [PHOTOS.friends, PHOTOS.music, PHOTOS.photo],
    slots: "6/8",
  },
];

export function PhoneScreenUI() {
  return (
    <div className="flex h-full w-full flex-col bg-white font-sans">
      {/* status bar */}
      <div className="flex items-center gap-2.5 px-4 pt-10">
        <Avatar src={PHOTOS.friends} size="h-7 w-7" />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-text-muted">@trailbrew</p>
          <p className="mt-0.5 text-[12px] font-bold leading-tight text-text">
            Find your people nearby
          </p>
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-light">
          <Coffee size={12} color="#E8634D" />
        </span>
      </div>

      {/* map */}
      <div className="relative mx-3 mt-2.5 h-[27%] min-h-[90px] overflow-hidden rounded-xl border border-border-light">
        <img
          src={PHOTOS.tokyo}
          alt=""
          className="h-full w-full object-cover opacity-60"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white/60 to-transparent" />
        {[
          { top: "24%", left: "34%", on: true },
          { top: "46%", left: "60%", on: false },
          { top: "38%", left: "16%", on: false },
          { top: "66%", left: "44%", on: false },
        ].map((p, i) => (
          <span
            key={i}
            className={`absolute h-2.5 w-2.5 rounded-full border-[1.5px] border-white shadow-md ${
              p.on ? "bg-accent" : "bg-text"
            }`}
            style={{ top: p.top, left: p.left }}
          />
        ))}
        <span className="absolute left-2 top-1.5 rounded-full bg-white px-2 py-0.5 text-[8px] font-bold text-text shadow-md">
          12 meetups nearby
        </span>
      </div>

      {/* section label */}
      <div className="flex items-baseline justify-between px-4 pt-2.5">
        <p className="text-[11px] font-bold text-text">This weekend</p>
        <span className="text-[8px] font-semibold text-accent">See all</span>
      </div>

      {/* event cards */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 pb-1.5 pt-1.5">
        {CARDS.map((c) => (
          <div
            key={c.title}
            className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-white p-2 shadow-sm"
          >
            <img
              src={c.thumb}
              alt=""
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
              loading="lazy"
              decoding="async"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <c.icon size={11} color={c.iconColor} className="shrink-0" />
                <p className="min-w-0 flex-1 truncate text-[10px] font-bold text-text">{c.title}</p>
                <span className="shrink-0 text-[10px] font-bold" style={{ color: c.fitColor }}>
                  {c.fit}
                </span>
              </div>
              <p className="text-[8.5px] text-text-muted">{c.meta}</p>
              <div className="mt-0.5 flex items-center gap-1">
                <div className="flex -space-x-1">
                  {c.avatars.map((a, i) => (
                    <Avatar key={i} src={a} size="h-3.5 w-3.5" />
                  ))}
                </div>
                <span className="text-[8px] text-text-muted">{c.slots} going</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* bottom nav */}
      <div className="flex items-center justify-around border-t border-border-light px-4 py-2">
        {[
          { I: Home, active: true },
          { I: Compass, active: false },
          { I: Users, active: false },
          { I: MessageCircle, active: false },
        ].map(({ I, active }, i) => (
          <span
            key={i}
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{ background: active ? "#FFF0ED" : "transparent" }}
          >
            <I size={13} color={active ? "#E8634D" : "#B9B2AB"} strokeWidth={active ? 2.4 : 2} />
          </span>
        ))}
      </div>
    </div>
  );
}