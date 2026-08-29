"use client";

import { Reveal } from "@/components/ui/Reveal";
import { Highlight } from "@/components/ui/Highlight";
import { PHOTOS, LANGUAGES } from "@/lib/constants";

export function JapanSection() {
  return (
    <section id="japan" className="py-24 md:py-32 bg-bg relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <Reveal>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-text leading-[0.95]">
                Different languages.<br />Same reason to<br /><Highlight>gather.</Highlight>
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 text-lg text-text-muted leading-relaxed max-w-md">
                Atsumaru supports Japanese, English, and Simplified Chinese — because great connections don&apos;t depend on which language you speak.
              </p>
            </Reveal>

            {/* Language pills */}
            <Reveal delay={0.3}>
              <div className="mt-8 flex flex-wrap gap-3">
                {LANGUAGES.map((l) => (
                  <div key={l.name} className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-surface border border-border">
                    <span className="text-xl">{l.flag}</span>
                    <span className="text-sm font-medium text-text">{l.name}</span>
                    <span className="text-xs text-text-muted">{l.code}</span>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Stats */}
            <Reveal delay={0.35}>
              <div className="mt-10 grid grid-cols-3 gap-4">
                {[
                  { stat: "4–6", label: "people per group" },
                  { stat: "3", label: "languages" },
                  { stat: "1", label: "shared activity" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className="text-3xl md:text-4xl font-bold text-accent">{s.stat}</p>
                    <p className="text-xs text-text-muted mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Photo */}
          <Reveal from="right">
            <div className="relative rounded-3xl overflow-hidden aspect-[4/5]">
              <img
                src={PHOTOS.tokyo}
                alt="Tokyo cityscape"
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-dark/40 to-transparent" />

              {/* Floating language badges */}
              <div className="absolute top-6 right-6 bg-white/10 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10">
                <span className="text-sm font-bold text-text-light">日本語</span>
              </div>
              <div className="absolute top-20 left-6 bg-white/10 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10">
                <span className="text-sm font-bold text-text-light">English</span>
              </div>
              <div className="absolute bottom-20 right-10 bg-white/10 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10">
                <span className="text-sm font-bold text-text-light">中文</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
