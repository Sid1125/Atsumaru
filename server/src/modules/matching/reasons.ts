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
