import type { ReactNode } from "react";

export function Highlight({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block text-accent whitespace-nowrap">
      {children}
      <svg
        className="absolute -bottom-[0.2em] left-0 h-[0.14em] w-full overflow-visible"
        viewBox="0 0 120 16"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M5 11 C 22 4, 40 13, 58 9 S 92 5, 115 10" stroke="var(--color-accent)" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </span>
  );
}