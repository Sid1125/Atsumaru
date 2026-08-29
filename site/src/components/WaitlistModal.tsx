"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import { X, Sparkles, Check, Copy, CheckCircle2, ArrowRight } from "lucide-react";

const CITIES = [
  { id: "tokyo", name: "Tokyo", nameJp: "東京" },
  { id: "osaka", name: "Osaka", nameJp: "大阪" },
  { id: "kyoto", name: "Kyoto", nameJp: "京都" },
  { id: "yokohama", name: "Yokohama", nameJp: "横浜" },
  { id: "other", name: "Other / Remote", nameJp: "その他" },
];

const INTERESTS = [
  "🍜 Ramen",
  "🎮 Board Games",
  "🥾 Weekend Hikes",
  "☕ Café Hopping",
  "🎨 Art & Design",
  "📷 Photography",
];

export function openWaitlistModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-waitlist"));
  }
}

export function WaitlistModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedCity, setSelectedCity] = useState("tokyo");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["🍜 Ramen", "☕ Café Hopping"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [queueNumber, setQueueNumber] = useState(482);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setIsSubmitted(false);
      setCopied(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    };

    window.addEventListener("open-waitlist", handleOpen);
    return () => window.removeEventListener("open-waitlist", handleOpen);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      const pseudoRandom = Math.floor(380 + Math.random() * 150);
      setQueueNumber(pseudoRandom);
    }, 700);
  };

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`https://atsumaru.app?ref=vip-${queueNumber}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-modal-title"
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/15 bg-[#141212] p-6 sm:p-8 text-text-light shadow-2xl shadow-black/80 transition-all duration-300">
        {/* Ambient Top Glow */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(232,99,77,0.3) 0%, transparent 70%)",
          }}
        />

        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-text-muted-light hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {!isSubmitted ? (
          <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-accent">
                <Sparkles size={13} />
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                Early Access
              </span>
            </div>

            <h2 id="waitlist-modal-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Gather with us in Japan.
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-text-muted-light leading-relaxed">
              We&apos;re onboarding small cohorts in Tokyo & Kansai first. Reserve your spot for the next gathering wave.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {/* City Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted-light mb-2.5">
                  Your City / Area
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {CITIES.map((c) => {
                    const isSelected = selectedCity === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setSelectedCity(c.id)}
                        className={`flex flex-col items-center justify-center rounded-xl p-2.5 border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-accent-strong text-white border-accent shadow-md shadow-accent/25"
                            : "bg-white/5 border-white/10 text-text-muted-light hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className="text-xs font-bold">{c.name}</span>
                        <span className="text-[10px] opacity-75">{c.nameJp}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interests */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted-light mb-2.5">
                  Activities you love
                </label>
                <div className="flex flex-wrap gap-2">
                  {INTERESTS.map((interest) => {
                    const isSelected = selectedInterests.includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-accent/20 border-accent text-white shadow-sm"
                            : "bg-white/5 border-white/10 text-text-muted-light hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label htmlFor="waitlist-email" className="block text-xs font-semibold uppercase tracking-wider text-text-muted-light mb-2">
                  Email Address
                </label>
                <input
                  ref={inputRef}
                  id="waitlist-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-12 rounded-xl bg-white/5 border border-white/15 px-4 text-sm text-white placeholder:text-text-muted-light/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl bg-accent-strong text-white font-semibold text-sm hover:bg-accent-strong/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/30 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Securing your spot...
                  </span>
                ) : (
                  <>
                    Request Early Access
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Confirmation State with Japanese Hanko Stamp */
          <div className="text-center py-4">
            {/* Hanko Stamp Animation */}
            <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
              <div
                className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl border-2 border-accent text-accent shadow-[0_0_30px_rgba(232,99,77,0.35)] rotate-[-6deg]"
                style={{
                  background: "radial-gradient(circle, rgba(232,99,77,0.12) 0%, transparent 80%)",
                }}
              >
                <span className="font-jp text-lg font-bold leading-none tracking-wider">集まる</span>
                <span className="mt-1 text-[9px] font-extrabold uppercase tracking-widest text-accent">VIP PASS</span>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent mb-3">
              <CheckCircle2 size={13} />
              You&apos;re on the early list!
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Spot #{queueNumber} reserved.
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-text-muted-light max-w-sm mx-auto leading-relaxed">
              We sent a confirmation to <span className="font-semibold text-white">{email}</span>. We&apos;ll notify you as soon as meetups launch in your area.
            </p>

            {/* Invite card */}
            <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 p-4 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted-light">Share your invite link</p>
                  <p className="text-xs text-white truncate mt-0.5">https://atsumaru.app?ref=vip-{queueNumber}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent-strong px-3 text-xs font-semibold text-white hover:bg-accent-strong/90 transition-all cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check size={13} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="mt-6 text-xs text-text-muted-light hover:text-white transition-colors cursor-pointer"
            >
              Close and back to site
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
