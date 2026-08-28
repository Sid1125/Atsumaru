"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_LINKS, SITE } from "@/lib/constants";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-bg-dark/95 backdrop-blur-xl shadow-[0_1px_0_0_rgba(255,255,255,0.05)]"
          : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className={`flex items-center justify-between transition-all duration-500 ${scrolled ? "h-16" : "h-20"}`}>
            {/* Logo */}
            <a href="#" className="flex items-baseline gap-2 group">
              <span className="text-lg font-bold text-text-light tracking-tight">
                {SITE.name}
              </span>
              <span className="text-sm text-text-muted-light font-medium">
                {SITE.nameJp}
              </span>
            </a>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="text-sm text-text-muted-light hover:text-text-light transition-colors duration-200">
                  {link.label}
                </a>
              ))}
              <a href="#cta" className="h-10 px-5 text-sm font-semibold rounded-full bg-accent text-white hover:bg-accent/90 transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-accent/20 inline-flex items-center">
                Get early access
              </a>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 -mr-2 text-text-light"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={`fixed inset-0 z-40 bg-bg-dark transition-opacity duration-300 md:hidden ${
        mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}>
        <div className="flex flex-col items-center justify-center h-full gap-8">
          {NAV_LINKS.map((link, i) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="text-2xl font-medium text-text-light hover:text-accent transition-colors"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              {link.label}
            </a>
          ))}
          <a href="#cta" onClick={() => setMobileOpen(false)} className="mt-4 h-12 px-8 text-base font-semibold rounded-full bg-accent text-white">
            Get early access
          </a>
        </div>
      </div>
    </>
  );
}
