import { create } from "zustand";

import type { Language, User } from "../types/api";
import {
  clearAccessToken,
  setAccessToken,
} from "../services/storage/session";

interface AuthState {
  user: User | null;
  /**
   * Whether a session token is held. Deliberately separate from `user`: OAuth
   * succeeds *before* a profile exists, and `GET /auth/me` answers `{ user: null }`
   * until onboarding writes the row. Collapsing the two is what made the onboarding
   * stack unreachable — a new user looked identical to a signed-out one.
   */
  isAuthenticated: boolean;
  isBootstrapped: boolean;
  setUser: (user: User | null) => void;
  setAuthenticated: (value: boolean) => void;
  setBootstrapped: (value: boolean) => void;
  /** `user` is null for a brand-new account that has not onboarded yet. */
  signIn: (token: string, user: User | null) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapped: false,
  setUser: (user) => set({ user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setBootstrapped: (isBootstrapped) => set({ isBootstrapped }),
  signIn: async (token, user) => {
    await setAccessToken(token);
    set({ user, isAuthenticated: true });
  },
  signOut: async () => {
    await clearAccessToken();
    set({ user: null, isAuthenticated: false });
  },
}));

interface UiState {
  language: Language;
  selectedCategory: string | null;
  setLanguage: (language: Language) => void;
  setSelectedCategory: (category: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  language: "en",
  selectedCategory: null,
  setLanguage: (language) => set({ language }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
}));

interface OnboardingDraftState {
  interests: string[];
  personality: string[];
  handle: string;
  displayName: string;
  setExtracted: (interests: string[], personality: string[]) => void;
  setHandle: (handle: string) => void;
  setDisplayName: (displayName: string) => void;
  reset: () => void;
}

export const useOnboardingDraft = create<OnboardingDraftState>((set) => ({
  interests: [],
  personality: [],
  handle: "",
  displayName: "",
  setExtracted: (interests, personality) => set({ interests, personality }),
  setHandle: (handle) => set({ handle }),
  setDisplayName: (displayName) => set({ displayName }),
  reset: () =>
    set({ interests: [], personality: [], handle: "", displayName: "" }),
}));
