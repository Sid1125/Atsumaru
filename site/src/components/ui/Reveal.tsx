"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: "up" | "left" | "right";
}

export function Reveal({ children, className = "", delay = 0, from = "up" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const offsets = { up: { y: 40 }, left: { x: -40 }, right: { x: 40 } };
    gsap.set(el, { opacity: 0, ...offsets[from] });

    const tween = gsap.to(el, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.8,
      delay,
      ease: "expo.out",
      scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
    });

    return () => { tween.kill(); ScrollTrigger.getAll().forEach((t) => { if (t.trigger === el) t.kill(); }); };
  }, [delay, from]);

  return <div ref={ref} className={className}>{children}</div>;
}
