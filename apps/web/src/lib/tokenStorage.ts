/**
 * Isolates refresh-token persistence behind a small module so the storage
 * mechanism can be swapped later (e.g. for an httpOnly cookie set by the
 * server) without touching any call site. Phase 1 uses localStorage, which
 * is acceptable for the admin SPA but is not the final answer — XSS on this
 * app would expose the refresh token. The access token is never persisted
 * here; it lives only in memory (the zustand auth store) and is re-acquired
 * via /auth/refresh on page reload.
 */
const REFRESH_TOKEN_KEY = "qassemiya.refreshToken";

export const tokenStorage = {
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  clearRefreshToken(): void {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
