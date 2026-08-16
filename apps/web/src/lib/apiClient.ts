import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AuthTokens } from "@qassemiya/shared-types";
import { useAuthStore } from "@/store/authStore";
import { tokenStorage } from "./tokenStorage";

const baseURL = import.meta.env.VITE_API_URL;

/** Main client used by every api/*.ts call — carries the access token and auto-refreshes on 401. */
export const apiClient = axios.create({ baseURL });

/** Bare client with no interceptors, used only for the refresh call itself to avoid recursive 401 handling. */
const refreshClient = axios.create({ baseURL });

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Single-flight guard so N concurrent 401s trigger exactly one refresh call.
let refreshPromise: Promise<string | null> | null = null;

/** Exported so the app bootstrap (silent-restore-on-load) can reuse the same refresh logic. */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) return null;
  try {
    const { data } = await refreshClient.post<AuthTokens>("/auth/refresh", { refreshToken });
    useAuthStore.getState().setAccessToken(data.accessToken);
    tokenStorage.setRefreshToken(data.refreshToken);
    return data.accessToken;
  } catch {
    useAuthStore.getState().clearSession();
    tokenStorage.clearRefreshToken();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    const isAuthEndpoint = originalRequest?.url?.startsWith("/auth/");

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccessToken = await refreshPromise;

      if (newAccessToken) {
        originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);
