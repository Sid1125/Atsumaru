import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "atsumaru.access_token";
const REFRESH_TOKEN_KEY = "atsumaru.refresh_token";

// Tokens live in SecureStore only (docs/TRD.md §15) — never AsyncStorage, never logged.
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

/**
 * The refresh token is the only way back from an expired access token, so it gets the same
 * SecureStore treatment. It was previously typed by the API layer and then thrown away,
 * which left the app dead-ending on the first 401 with no re-auth path (TRACKER.md §5).
 * Supabase rotates it on every use, so each refresh overwrites what is stored here.
 */
export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setSession(
  accessToken: string,
  refreshToken?: string | null
): Promise<void> {
  await setAccessToken(accessToken);

  // A caller with no refresh token to offer must not silently drop the one already held.
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
