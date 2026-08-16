import type { Permission } from "@qassemiya/shared-types";

/**
 * Shape attached to `request.user` by JwtStrategy after validating the
 * access token. Carries a flattened view of the user's branch-scoped grants
 * so PermissionsGuard doesn't need to hit the DB per-request.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  fullName: string;
  /** Branch-scoped grants. branchId null = global (e.g. SUPER_ADMIN). */
  grants: Array<{ branchId: string | null; permissions: Permission[] }>;
  /** Present only for POS-issued tokens (PIN login), the paired device's fixed branch. */
  deviceBranchId?: string;
  employeeId?: string;
}
