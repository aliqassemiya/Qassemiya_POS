import axios, { type AxiosInstance } from "axios";
import { getMeta, setMeta, LocalMetaKey } from "./db/local-meta";

let client: AxiosInstance | null = null;
let cachedApiUrl = "";
let refreshInFlight: Promise<string | null> | null = null;

/**
 * The till's access token is short-lived (~15min per the auth design), but
 * the background sync worker keeps running long after any cashier
 * interactively logged in — e.g. overnight with pending offline orders.
 * Without this, every sync call after token expiry would 401 forever until
 * someone next logs in, silently breaking the "sync once back online"
 * guarantee. Single-flight: concurrent 401s from sync + catalog pull +
 * checkout share one refresh call instead of racing.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = await getMeta(LocalMetaKey.REFRESH_TOKEN);
    const apiUrl = (await getMeta(LocalMetaKey.API_URL)) ?? cachedApiUrl;
    if (!refreshToken || !apiUrl) return null;

    try {
      const { data } = await axios.post(`${apiUrl}/auth/refresh`, { refreshToken });
      const accessToken: string | undefined = data?.accessToken;
      const nextRefreshToken: string | undefined = data?.refreshToken;
      if (!accessToken) return null;
      await setMeta(LocalMetaKey.ACCESS_TOKEN, accessToken);
      if (nextRefreshToken) await setMeta(LocalMetaKey.REFRESH_TOKEN, nextRefreshToken);
      return accessToken;
    } catch {
      // Refresh token itself expired/revoked — nothing to do but wait for the next interactive PIN login.
      return null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/** Lazily-built axios instance; base URL + bearer token are re-read from LocalMeta on every request. */
export function getApiClient(): AxiosInstance {
  if (!client) {
    client = axios.create({ timeout: 15_000 });

    client.interceptors.request.use(async (config) => {
      const apiUrl = (await getMeta(LocalMetaKey.API_URL)) ?? cachedApiUrl;
      config.baseURL = apiUrl ?? undefined;
      const token = await getMeta(LocalMetaKey.ACCESS_TOKEN);
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const original = error.config;
        if (error.response?.status !== 401 || original?._retried || original?.url?.includes("/auth/")) {
          return Promise.reject(error);
        }
        const newToken = await refreshAccessToken();
        if (!newToken) return Promise.reject(error);

        original._retried = true;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return client!.request(original);
      },
    );
  }
  return client;
}

export async function getApiUrl(): Promise<string> {
  const stored = await getMeta(LocalMetaKey.API_URL);
  if (stored) {
    cachedApiUrl = stored;
    return stored;
  }
  return cachedApiUrl;
}

export async function setApiUrl(url: string): Promise<void> {
  cachedApiUrl = url;
  await setMeta(LocalMetaKey.API_URL, url);
}

/** Synchronous best-effort accessor for the connectivity monitor (falls back to the last-known value). */
export function getCachedApiUrl(): string {
  return cachedApiUrl;
}

export async function primeApiUrlCache(): Promise<void> {
  cachedApiUrl = (await getMeta(LocalMetaKey.API_URL)) ?? "";
}
