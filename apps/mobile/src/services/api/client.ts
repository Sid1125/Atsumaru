import axios, { AxiosError, AxiosRequestConfig } from "axios";

import { API_URL, DEMO_MODE } from "../../config/env";
import { useAuthStore } from "../../store";
import {
  getAccessToken,
  getRefreshToken,
  setSession,
} from "../storage/session";
import { ApiError } from "./errors";
import { demoRequest } from "./demo";

export { ApiError };

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use(async (config) => {
  const token = await getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const REFRESH_PATH = "/auth/refresh";

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Recovers an expired session. Supabase access tokens are short-lived, and the app used to
 * keep only the access token with no 401 handling at all, so the first expiry turned every
 * screen into a silent failure with no way back (TRACKER.md §5).
 *
 * One refresh at a time. A screen with four queries in flight would otherwise fire four
 * refreshes, and because Supabase *rotates* the refresh token on use, three of them would
 * be redeeming an already-spent token and would take the session down with them.
 */
async function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const refreshToken = await getRefreshToken();

      // Nothing to refresh with: a session minted before refresh tokens were stored, or a
      // genuinely signed-out app.
      if (!refreshToken) return false;

      const session = await request<{
        access_token: string;
        refresh_token: string;
      }>(
        { method: "POST", url: REFRESH_PATH, data: { refresh_token: refreshToken } },
        false
      );

      await setSession(session.access_token, session.refresh_token);

      return true;
    } catch {
      // Expired, revoked, or already rotated. The tokens are worthless either way, so they
      // go rather than being retried on every later request, and the app is told to route
      // back to login instead of showing errors on every screen.
      await useAuthStore.getState().signOut();

      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  // Read into a local first: the `finally` above clears the field, and a second caller
  // arriving after that must start its own refresh rather than await `null`.
  const inFlight = refreshInFlight;

  return inFlight ?? false;
}

// Single place that unwraps the { success, data } contract (docs/API_STRUCTURE.md §1).
// Screens never call fetch/axios directly (docs/RULES.md §5).
async function request<T>(
  config: AxiosRequestConfig,
  allowRefresh = true
): Promise<T> {
  // Demo mode swaps the transport, not the contract: everything above this line —
  // query keys, hooks, screens — is identical in both modes (see demo/index.ts).
  if (DEMO_MODE) {
    return demoRequest<T>(
      (config.method ?? "GET").toUpperCase() as "GET" | "POST" | "PATCH" | "DELETE",
      config.url ?? "",
      config.params ?? config.data
    );
  }

  try {
    const response = await axiosInstance.request<Envelope<T>>(config);
    const body = response.data;

    if (!body || typeof body !== "object" || !("success" in body)) {
      throw new ApiError("BAD_RESPONSE", "Unexpected response from server.");
    }

    if (!body.success) {
      throw new ApiError(body.error.code, body.error.message, response.status);
    }

    return body.data;
  } catch (error) {
    const apiError = asApiError(error);

    // A 401 is the one error worth retrying, and only once: refresh, then replay the
    // original request with the new token. The refresh call itself is excluded, or a
    // rejected refresh would recurse.
    if (
      apiError.status === 401 &&
      allowRefresh &&
      config.url !== REFRESH_PATH &&
      (await refreshSession())
    ) {
      return request<T>(config, false);
    }

    throw apiError;
  }
}

function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  const axiosError = error as AxiosError<Envelope<unknown>>;
  const payload = axiosError.response?.data;

  if (payload && typeof payload === "object" && payload.success === false) {
    return new ApiError(
      payload.error.code,
      payload.error.message,
      axiosError.response?.status
    );
  }

  return new ApiError(
    axiosError.code ?? "NETWORK_ERROR",
    axiosError.message || "Network request failed.",
    axiosError.response?.status
  );
}

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    request<T>({ method: "GET", url, params }),
  post: <T>(url: string, data?: unknown) =>
    request<T>({ method: "POST", url, data }),
  patch: <T>(url: string, data?: unknown) =>
    request<T>({ method: "PATCH", url, data }),
  del: <T>(url: string) => request<T>({ method: "DELETE", url }),
};
