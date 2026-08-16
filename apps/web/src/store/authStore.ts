import { create } from "zustand";
import type { AuthUser } from "@/types/entities";

interface AuthState {
  /** Short-lived JWT, kept in memory only — never persisted. */
  accessToken: string | null;
  user: AuthUser | null;
  /** Branch context for SUPER_ADMIN/BRANCH_MANAGER, who can switch branches. */
  activeBranchId: string | null;
  /** True once the initial silent-refresh-on-load attempt has settled. */
  isHydrated: boolean;
  setSession: (params: { accessToken: string; user: AuthUser }) => void;
  setAccessToken: (accessToken: string) => void;
  setActiveBranch: (branchId: string | null) => void;
  clearSession: () => void;
  setHydrated: (value: boolean) => void;
}

function defaultBranchId(user: AuthUser): string | null {
  const scoped = user.roles.find((r) => r.branchId !== null);
  return scoped ? scoped.branchId : null;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  activeBranchId: null,
  isHydrated: false,
  setSession: ({ accessToken, user }) =>
    set({ accessToken, user, activeBranchId: defaultBranchId(user) }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setActiveBranch: (branchId) => set({ activeBranchId: branchId }),
  clearSession: () => set({ accessToken: null, user: null, activeBranchId: null }),
  setHydrated: (value) => set({ isHydrated: value }),
}));
