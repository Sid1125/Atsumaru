"use client";

import { PHOTOS } from "@/lib/constants";

export function PhoneScreenUI() {
  return (
    <div
      style={{
        width: "520px",
        height: "1040px",
        background: "#fff",
        borderRadius: "20px",
        overflow: "hidden",
        fontFamily: "'Inter', 'Noto Sans JP', system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Status bar */}
      <div style={{ padding: "52px 24px 0" }}>
        <p style={{ fontSize: "13px", color: "#6B6560", margin: 0 }}>@trailbrew</p>
        <p style={{ fontSize: "16px", fontWeight: 700, color: "#1A1A1A", marginTop: "2px" }}>
          Find your people nearby
        </p>
      </div>

      {/* Map */}
      <div
        style={{
          margin: "16px 16px 0",
          borderRadius: "16px",
          height: "260px",
          position: "relative",
          overflow: "hidden",
          border: "1px solid #F0EDE6",
        }}
      >
        <img
          src={PHOTOS.tokyo}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.6 }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(255,255,255,0.5), transparent)",
          }}
        />
        {/* Map pins */}
        {[
          { top: "25%", left: "35%" },
          { top: "50%", left: "62%" },
          { top: "40%", left: "20%" },
          { top: "65%", left: "48%" },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              width: "16px",
              height: "16px",
              background: "#E8634D",
              borderRadius: "50%",
              boxShadow: "0 2px 8px rgba(232,99,77,0.4)",
              border: "2.5px solid white",
            }}
          />
        ))}
      </div>

      {/* Event cards */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Card 1 */}
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "14px",
            border: "1px solid #E8E4DF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px" }}>🍜</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
                Ramen & Retro Games
              </p>
              <p style={{ fontSize: "11px", color: "#6B6560", margin: "2px 0 0" }}>
                Shibuya · Sat 7 PM
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#E8634D", margin: 0 }}>91%</p>
              <p style={{ fontSize: "9px", color: "#6B6560", margin: 0 }}>fit</p>
            </div>
          </div>
          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ display: "flex" }}>
              {["🎨", "🎮", "🍜", "☕"].map((e, i) => (
                <span
                  key={i}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#1A1A1A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "9px",
                    border: "1.5px solid white",
                    marginLeft: i > 0 ? "-4px" : 0,
                  }}
                >
                  {e}
                </span>
              ))}
            </div>
            <span style={{ fontSize: "10px", color: "#6B6560", marginLeft: "4px" }}>
              5/6 people
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "14px",
            border: "1px solid #E8E4DF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px" }}>🎮</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
                Board Game Night
              </p>
              <p style={{ fontSize: "11px", color: "#6B6560", margin: "2px 0 0" }}>
                Daikanyama · Fri 8 PM
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "16px", fontWeight: 700, color: "#7A9E7E", margin: 0 }}>87%</p>
              <p style={{ fontSize: "9px", color: "#6B6560", margin: 0 }}>fit</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
