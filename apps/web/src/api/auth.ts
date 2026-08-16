import type { LoginInput } from "@qassemiya/shared-types";
import { apiClient } from "@/lib/apiClient";
import type { AuthUser, LoginResponse } from "@/types/entities";

export async function login(input: LoginInput): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", input);
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post("/auth/logout", { refreshToken });
}

/**
 * Assumption: UsersModule exposes a "who am I" endpoint. Used only to
 * rehydrate `user`/permissions after a silent token refresh on page load
 * (POST /auth/refresh itself only returns tokens, per authTokensSchema).
 * If this endpoint doesn't exist server-side, the silent-restore attempt
 * simply fails closed and the user is sent back to /login — no hard crash.
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const { data } = await apiClient.get<AuthUser>("/users/me");
  return data;
}
