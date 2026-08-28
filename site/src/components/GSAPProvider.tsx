"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function GSAPProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.fonts.ready.then(() => ScrollTrigger.refresh());

    // Magnetic button effect
    const fns: Array<() => void> = [];
    document.querySelectorAll<HTMLElement>(".magnetic-btn").forEach((btn) => {
      const enter = () => gsap.to(btn, { scale: 1.05, duration: 0.3, ease: "power2.out" });
      const leave = () => gsap.to(btn, { x: 0, y: 0, scale: 1, duration: 0.5, ease: "elastic.out(1, 0.3)" });
      const move = (e: MouseEvent) => {
        const r = btn.getBoundingClientRect();
        gsap.to(btn, { x: (e.clientX - r.left - r.width / 2) * 0.3, y: (e.clientY - r.top - r.height / 2) * 0.3, duration: 0.3, ease: "power2.out" });
      };
      btn.addEventListener("mouseenter", enter);
      btn.addEventListener("mouseleave", leave);
      btn.addEventListener("mousemove", move);
      fns.push(() => { btn.removeEventListener("mouseenter", enter); btn.removeEventListener("mouseleave", leave); btn.removeEventListener("mousemove", move); });
    });

    return () => { ScrollTrigger.getAll().forEach((t) => t.kill()); fns.forEach((fn) => fn()); };
  }, []);

  return <>{children}</>;
}
