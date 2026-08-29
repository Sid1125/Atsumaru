"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SITE, NAV_LINKS } from "@/lib/constants";

gsap.registerPlugin(ScrollTrigger);

export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tween = gsap.fromTo(
      inner,
      { yPercent: -35 },
      {
        yPercent: 0,
        ease: "none",
        scrollTrigger: {
          trigger: ref.current,
          start: "top bottom",
          end: "bottom bottom",
          scrub: true,
        },
      }
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <footer ref={ref} className="overflow-hidden border-t border-border-dark bg-bg-dark text-text-light">
      <div ref={innerRef} className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:py-16 will-change-transform">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-lg font-bold">{SITE.name}</span>
              <span className="text-sm text-text-muted-light font-medium">{SITE.nameJp}</span>
            </div>
            <p className="text-sm text-text-muted-light max-w-sm">{SITE.tagline}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted-light mb-4">Product</p>
            <ul className="space-y-2.5">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-sm text-text-muted-light hover:text-text-light transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted-light mb-4">Legal</p>
            <ul className="space-y-2.5">
              {["Privacy", "Terms", "Contact"].map((l) => (
                <li key={l}>
                  <span className="text-sm text-text-muted-light/50 cursor-default">{l}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border-dark flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted-light/40">
            &copy; {new Date().getFullYear()} Atsumaru. All rights reserved.
          </p>
          <p className="text-xs text-text-muted-light/30">
            Built for the WeLive Appathon
          </p>
        </div>
      </div>
    </footer>
  );
}
