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
    const footerEl = ref.current;
    const inner = innerRef.current;
    if (!footerEl || !inner || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      // Parallax curtain reveal: the inner block starts a third of the way up and
      // settles into place exactly as the footer's bottom meets the viewport bottom
      // (Awwwards scroll reference 66). Layout is untouched — only the transform moves.
      gsap.fromTo(
        inner,
        { yPercent: -35 },
        {
          yPercent: 0,
          ease: "none",
          scrollTrigger: {
            trigger: footerEl,
            start: "top bottom",
            end: "bottom bottom",
            scrub: true,
          },
        }
      );
    }, footerEl);

    return () => {
      ctx.revert();
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
                  <span className="text-sm text-text-muted-light hover:text-text-light cursor-pointer transition-colors">{l}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border-dark flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted-light">
            &copy; {new Date().getFullYear()} Atsumaru. All rights reserved.
          </p>
          <p className="text-xs text-text-muted-light">
            Built for the WeLive Appathon · Tokyo &amp; Kansai
          </p>
        </div>
      </div>
    </footer>
  );
}
