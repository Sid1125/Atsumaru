import { create } from "zustand";

import type { Language, User } from "../types/api";
import {
  clearAccessToken,
  setAccessToken,
} from "../services/storage/session";

interface AuthState {
  user: User | null;
  isBootstrapped: boolean;
  setUser: (user: User | null) => void;
  setBootstrapped: (value: boolean) => void;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isBootstrapped: false,
  setUser: (user) => set({ user }),
  setBootstrapped: (isBootstrapped) => set({ isBootstrapped }),
  signIn: async (token, user) => {
    await setAccessToken(token);
    set({ user });
  },
  signOut: async () => {
    await clearAccessToken();
    set({ user: null });
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
