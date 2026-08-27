import axios, { AxiosError, AxiosRequestConfig } from "axios";

import { API_URL } from "../../config/env";
import { getAccessToken } from "../storage/session";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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

// Single place that unwraps the { success, data } contract (docs/API_STRUCTURE.md §1).
// Screens never call fetch/axios directly (docs/RULES.md §5).
async function request<T>(config: AxiosRequestConfig): Promise<T> {
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
    if (error instanceof ApiError) throw error;

    const axiosError = error as AxiosError<Envelope<unknown>>;
    const payload = axiosError.response?.data;

    if (payload && typeof payload === "object" && payload.success === false) {
      throw new ApiError(
        payload.error.code,
        payload.error.message,
        axiosError.response?.status
      );
    }

    throw new ApiError(
      axiosError.code ?? "NETWORK_ERROR",
      axiosError.message || "Network request failed.",
      axiosError.response?.status
    );
  }
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
