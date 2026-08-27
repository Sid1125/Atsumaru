/** Shared domain primitives. Supported locales come from docs/PRD.md §6.2. */
export type Language = "ja" | "en" | "zh";

export const LANGUAGES = ["ja", "en", "zh"] as const satisfies readonly Language[];
