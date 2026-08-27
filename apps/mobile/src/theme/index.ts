// Shared visual language for a calm, warm, activity-first product (docs/DESIGN.md §1).
export const colors = {
  background: "#FBF7F2",
  surface: "#FFFFFF",
  border: "#E8DFD4",
  text: "#221E1A",
  textMuted: "#6E655C",
  primary: "#D9603B",
  primaryText: "#FFFFFF",
  accent: "#2F6F62",
  danger: "#B3402C",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
};

export const typography = {
  title: { fontSize: 24, fontWeight: "700" as const },
  heading: { fontSize: 18, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
};
