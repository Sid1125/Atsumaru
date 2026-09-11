/**
 * Human-readable match reasons (docs/AI.md §5). The backend owns the wording so the
 * app only displays it, and it answers in the member's own language (docs/RULES.md §12).
 */

import type { Language } from "../../types.js";

interface ReasonInput {
  sharedInterests: string[];
  currentSize: number;
  maxSize: number;
  isMember: boolean;
  hasPreferenceVector: boolean;
}

const TEMPLATES = {
  en: {
    shared: (list: string) => `Shared interests: ${list}`,
    spots: (current: number, max: number) => `${current}/${max} spots taken`,
    member: "You are already in this group",
    noVector: "Finish onboarding for a sharper match",
  },
  ja: {
    shared: (list: string) => `共通の興味: ${list}`,
    spots: (current: number, max: number) => `${max}人中${current}人が参加`,
    member: "すでにこのグループに参加しています",
    noVector: "オンボーディングを終えると精度が上がります",
  },
  zh: {
    shared: (list: string) => `共同兴趣：${list}`,
    spots: (current: number, max: number) => `已加入 ${current}/${max} 人`,
    member: "你已经在这个小组里",
    noVector: "完成引导后匹配会更准确",
  },
} as const satisfies Record<Language, unknown>;

export function matchReasons(language: Language, input: ReasonInput): string[] {
  const text = TEMPLATES[language] ?? TEMPLATES.en;
  const reasons: string[] = [];

  if (input.sharedInterests.length > 0) {
    reasons.push(text.shared(input.sharedInterests.join(", ")));
  }

  reasons.push(text.spots(input.currentSize, input.maxSize));

  if (input.isMember) reasons.push(text.member);
  if (!input.hasPreferenceVector) reasons.push(text.noVector);

  return reasons;
}

/** Human-readable reasons for a 1:1 connection compatibility score. */
const CONNECTION_REASONS: Record<
  Language,
  {
    shared: (list: string) => string;
    compatible: string;
    noVector: string;
  }
> = {
  en: {
    shared: (list) => `Shared interests: ${list}`,
    compatible: "Great match",
    noVector: "Finish onboarding for a sharper match",
  },
  ja: {
    shared: (list) => `共通の興味: ${list}`,
    compatible: "相性抜群",
    noVector: "オンボーディングを終えると精度が上がります",
  },
  zh: {
    shared: (list) => `共同兴趣：${list}`,
    compatible: "非常契合",
    noVector: "完成引导后匹配会更准确",
  },
};

/**
 * Reasons for the 1:1 connection compatibility score. Mirrors `matchReasons` but
 * is scoped to a single pair rather than a group, so there is no "group balance"
 * line — only shared tags and the vector/cold-start note.
 */
export function connectionReasons(
  language: Language,
  input: {
    sharedInterests: string[];
    hasPreferenceVector: boolean;
  }
): string[] {
  const text = CONNECTION_REASONS[language] ?? CONNECTION_REASONS.en;
  const reasons: string[] = [];

  if (input.sharedInterests.length > 0) {
    reasons.push(text.shared(input.sharedInterests.join(", ")));
  }

  if (!input.hasPreferenceVector) reasons.push(text.noVector);

  if (reasons.length === 0) reasons.push(text.compatible);

  return reasons;
}
