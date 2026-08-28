import { type ReactNode } from "react";

interface PhoneMockupProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function PhoneMockup({ children, className = "", glow = false }: PhoneMockupProps) {
  return (
    <div className={`relative ${className}`}>
      {glow && (
        <div className="absolute -inset-4 bg-gradient-to-br from-accent/20 via-sage/10 to-accent/5 rounded-[60px] blur-2xl" />
      )}
      <div className="phone-realistic relative z-10">
        <div className="phone-realistic-screen flex flex-col">
          <div className="h-14" />
          {children}
        </div>
      </div>
    </div>
  );
}
