import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@qassemiya/shared-types";

export const PERMISSIONS_KEY = "requiredPermissions";

/**
 * Require the caller to hold at least one of the given permissions
 * (resolved from UserRole -> RolePermission, scoped to the request branch).
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
