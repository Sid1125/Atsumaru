import { ImageResponse } from "next/og";
import { SITE } from "@/lib/constants";

export const alt = "Atsumaru — Gather around what you love";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090B",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 40, color: "#C8FF00", letterSpacing: 8 }}>
            集まる
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: "#FAF7F2", letterSpacing: -2, lineHeight: 1.05 }}>
            {SITE.name}
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 40, color: "#FFB4A5", letterSpacing: -1 }}>
            {SITE.tagline}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "rgba(250,247,242,0.6)" }}>
          Not a dating app — friendship first.
        </div>
      </div>
    ),
    size
  );
}
