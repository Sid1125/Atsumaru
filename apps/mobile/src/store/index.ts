import { create } from "zustand";

import type { Coords, Language, User } from "../types/api";
import {
  clearAccessToken,
  setSession,
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
  /**
   * `user` is null for a brand-new account that has not onboarded yet. The refresh token
   * is kept beside the access token so an expired session can recover itself instead of
   * dead-ending every request (see services/api/client.ts).
   */
  signIn: (
    token: string,
    user: User | null,
    refreshToken?: string | null
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isBootstrapped: false,
  setUser: (user) => set({ user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setBootstrapped: (isBootstrapped) => set({ isBootstrapped }),
  signIn: async (token, user, refreshToken) => {
    await setSession(token, refreshToken);
    set({ user, isAuthenticated: true });
  },
  signOut: async () => {
    await clearAccessToken();
    set({ user: null, isAuthenticated: false });
  },
}));

interface LocationState {
  /**
   * The one-shot device fix Discover took, shared so the venue search in create-event
   * can bias and bound its results around the member instead of searching Japan-wide.
   * Only ever set from a real fix (never the Shibuya fallback), and no new location
   * read is taken anywhere to fill it — the same single read, reused (docs/RULES.md).
   */
  lastFix: Coords | null;
  setLastFix: (coords: Coords | null) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  lastFix: null,
  setLastFix: (lastFix) => set({ lastFix }),
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
  setInterests: (interests: string[]) => void;
  setPersonality: (personality: string[]) => void;
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
  setInterests: (interests) => set({ interests }),
  setPersonality: (personality) => set({ personality }),
  setHandle: (handle) => set({ handle }),
  setDisplayName: (displayName) => set({ displayName }),
  reset: () =>
    set({ interests: [], personality: [], handle: "", displayName: "" }),
}));
