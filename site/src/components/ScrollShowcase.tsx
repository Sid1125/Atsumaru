"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Soup, Gamepad2, Footprints, Coffee, Palette, PartyPopper, Calendar } from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PhoneScreenUI } from "@/components/ui/PhoneScreenUI";

gsap.registerPlugin(ScrollTrigger);

const PITCH_POINTS = [
  { title: "Small groups, big moments", body: "4–6 people per meetup. Never a crowded feed — always a real conversation." },
  { title: "AI that gets the vibe", body: "Matching on interests, your social style, and who actually fits." },
  { title: "Private by design", body: "Feedback never shared. Only mutual picks unlock a connection." },
];

const BUDDIES = [
  { icon: Soup, color: "#F08A5D", name: "Yuki" },
  { icon: Gamepad2, color: "#7A9E7E", name: "Sora" },
  { icon: Footprints, color: "#E4C25C", name: "Alex" },
  { icon: Coffee, color: "#8B5E3C", name: "Momo" },
  { icon: Palette, color: "#8B7EC8", name: "Rei" },
];

export function ScrollShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const phone = phoneRef.current;
    const popup = popupRef.current;
    const overlay = overlayRef.current;
    if (!section || !phone || !popup || !overlay) return;

    const banner = popup.querySelector<HTMLElement>(".match-banner");
    const head = popup.querySelector<HTMLElement>(".match-head");
    const avatars = popup.querySelectorAll<HTMLElement>(".buddy-avatar");
    const card = popup.querySelector<HTMLElement>(".match-card");

    gsap.set(phone, { rotateY: -28, rotateX: 55, scale: 1.15, x: 80, y: 90, z: -120 });
    gsap.set(overlay, { opacity: 0, y: 60 });
    gsap.set(popup, { opacity: 0, scale: 0.75, y: 80 });
    if (banner) gsap.set(banner, { y: -30, opacity: 0 });
    if (head) gsap.set(head, { scale: 0.6, opacity: 0, y: 30 });
    gsap.set(avatars, { scale: 0, opacity: 0, x: (i) => (i % 2 === 0 ? -30 : 30) });
    if (card) gsap.set(card, { y: 40, opacity: 0 });

    // Canvas-confetti burst — fires when scroll crosses midpoint of the zoom phase

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: "+=250%",
        pin: true,
        scrub: 0.6,
      },
    });

    // Phase 1 — pick the phone up off the surface (both tilts unwind)
    tl.to(phone, { rotateY: 0, rotateX: 0, x: 0, y: 0, z: 0, duration: 3, ease: "power1.inOut" }, 0);

    // Phase 2 — zoom in; screen fills viewport
    tl.to(phone, { scale: 1.6, duration: 5, ease: "power1.inOut" }, 1.5);

    // Phase 3 — match popup
    tl.to(popup, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: "back.out(1.5)" }, 3.6);

    if (banner) tl.to(banner, { y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.6)" }, 3.9);
    if (head) tl.to(head, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.7)" }, 4.0);

    tl.to(avatars, {
      scale: 1, opacity: 1, x: 0, duration: 0.45, ease: "back.out(1.9)", stagger: 0.08,
    }, 4.2);

    if (card) tl.to(card, { y: 0, opacity: 1, duration: 0.45, ease: "back.out(1.5)" }, 4.5);

    // Phase 4 — popup gives way to text overlay
    tl.to(popup, { opacity: 0, scale: 0.9, duration: 1.2, ease: "power1.in" }, 5.6);
    tl.to(overlay, { opacity: 1, y: 0, duration: 3, ease: "power1.out" }, 6);

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach((s) => s.kill());
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="bg-bg-dark relative overflow-hidden"
      style={{ height: "100vh" }}
    >
      {/* Giant tilted phone — top/bottom cut off by the section */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "1000px" }}
      >
        <div ref={phoneRef} style={{ aspectRatio: "280/570", height: "130vh", willChange: "transform" }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "60px",
              background: "#1a1a1a",
              padding: "9px",
              boxShadow: "0 40px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.06)",
              position: "relative",
            }}
          >
            {/* Dynamic Island */}
            <div
              style={{
                position: "absolute",
                top: "15px",
                left: "50%",
                transform: "translateX(-50%)",
                width: "24%",
                height: "22px",
                background: "#000",
                borderRadius: "20px",
                zIndex: 20,
              }}
            />
            {/* Screen */}
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50px",
                overflow: "hidden",
                background: "#fff",
                position: "relative",
              }}
            >
              <PhoneScreenUI />
            </div>
          </div>
        </div>
      </div>

      {/* Match popup — viewport anchored, cream-pink card */}
      <div
        ref={popupRef}
        className="absolute inset-0 z-30 flex items-center justify-center"
        style={{ pointerEvents: "none" }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at center, rgba(232,99,77,0.35) 0%, transparent 60%)",
          }}
        />

        {/* The card */}
        <div
          className="relative z-10 w-[88%] max-w-md rounded-[28px] border shadow-2xl overflow-hidden text-center"
          style={{
            background: "linear-gradient(160deg, #F7D5CA 0%, #FBEAE4 45%, #F0BCB0 100%)",
            borderColor: "rgba(232,99,77,0.4)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.45), 0 0 40px rgba(232,99,77,0.35), 0 0 0 1px rgba(232,99,77,0.2)",
            padding: "28px 24px 24px",
          }}
        >
          {/* Pill */}
          <div
            className="match-banner inline-flex items-center gap-1.5 rounded-full px-4 py-1.5"
            style={{
              background: "rgba(232,99,77,0.14)",
              border: "1px solid rgba(232,99,77,0.3)",
            }}
          >
            <span className="text-[13px]">
                  <PartyPopper size={13} color="#E8634D" />
                </span>
            <span className="text-[13px] font-extrabold uppercase tracking-wide text-accent">
              91% Group match
            </span>
          </div>

          {/* Headline */}
          <h3
            className="match-head mt-3 text-[34px] leading-[1.02] font-black tracking-tight"
            style={{ color: "#1A1A1A" }}
          >
            You&apos;ve got
            <br />
            hangout buddies!
          </h3>

          {/* Avatar row */}
          <div className="mt-5 flex items-center justify-center -space-x-3">
            {BUDDIES.map((b) => (
              <div
                key={b.name}
                className="buddy-avatar"
                title={b.name}
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  border: "3px solid #FFF",
                  background: "#fff",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                <b.icon size={24} style={{ color: b.color }} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-bold" style={{ color: "#4A3B36" }}>
            Yuki · Sora · Alex · Momo · Rei
          </p>

          {/* Divider */}
          <div
            className="mx-auto mt-4 h-px w-3/4"
            style={{ background: "rgba(232,99,77,0.18)" }}
          />

          {/* Date card */}
          <div
            className="match-card mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-3"
            style={{
              background: "#fff",
              border: "1px solid rgba(232,99,77,0.18)",
              boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
            }}
          >
            <span style={{ fontSize: "20px" }}>
                    <Calendar size={18} color="#E8634D" />
                  </span>
            <span className="text-[14px] font-bold" style={{ color: "#1A1A1A" }}>
              Board Game Night · Sat 8 PM
            </span>
          </div>
        </div>
      </div>

      {/* Final overlay — text on animated background */}
      <div
        ref={overlayRef}
        className="absolute inset-0 z-40 flex items-center justify-center"
        style={{ pointerEvents: "none" }}
      >
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden bg-bg-dark">
          <div
            className="absolute rounded-full blur-3xl opacity-40"
            style={{
              width: "45vw",
              height: "45vw",
              background: "radial-gradient(circle, rgba(232,99,77,0.5), transparent 65%)",
              left: "-10%",
              top: "-20%",
              animation: "blob-drift-a 18s ease-in-out infinite",
            }}
          />
          <div
            className="absolute rounded-full blur-3xl opacity-30"
            style={{
              width: "40vw",
              height: "40vw",
              background: "radial-gradient(circle, rgba(122,158,126,0.5), transparent 65%)",
              right: "-8%",
              bottom: "-15%",
              animation: "blob-drift-b 22s ease-in-out infinite",
            }}
          />
        </div>

        {/* Text content */}
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase text-accent mb-5">
            Why people stay
          </p>
          <h2 className="text-4xl md:text-6xl font-bold text-text-light tracking-tight leading-[1.02]">
            Real hangouts.
            <br />
            <span className="text-accent">Zero pressure.</span>
          </h2>

          <div className="mt-10 md:mt-14 grid sm:grid-cols-3 gap-6 text-left">
            {PITCH_POINTS.map((p) => (
              <div key={p.title} className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <p className="text-sm font-semibold text-text-light mb-2">{p.title}</p>
                <p className="text-xs text-text-muted-light leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>

          <a
            href="#cta"
            className="mt-10 inline-flex items-center h-12 px-7 text-sm font-semibold rounded-full bg-accent-strong text-white shadow-lg shadow-accent/30"
          >
            Join the waitlist
          </a>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
        <span className="text-[10px] text-text-muted-light/60 tracking-widest uppercase">Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-text-muted-light/40 to-transparent" />
      </div>
    </section>
  );
}