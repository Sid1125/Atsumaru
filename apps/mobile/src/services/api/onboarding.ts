import { api } from "./client";
import type {
  ChatTurn,
  Language,
  OnboardingChatResult,
  User,
} from "../../types/api";

export const onboardingApi = {
  chat: (messages: ChatTurn[], language?: Language) =>
    api.post<OnboardingChatResult>("/onboarding/chat", { messages, language }),

  suggestHandles: (interests: string[]) =>
    api.get<{ handles: string[] }>("/onboarding/suggest-handles", {
      interests: interests.join(","),
    }),

  checkHandle: (handle: string) =>
    api.get<{ available: boolean }>("/onboarding/check-handle", { handle }),

  complete: (payload: {
    handle: string;
    display_name: string;
    language: Language;
    interests: string[];
    personality: string[];
  }) => api.post<{ user: User }>("/onboarding/complete", payload),
};
