import { NotFoundException } from "@nestjs/common";
import type { Permission, RoleName } from "@qassemiya/shared-types";
import { PrismaService } from "../prisma/prisma.service";

export interface AuthUserView {
  id: string;
  email: string;
  fullName: string;
  roles: Array<{ role: RoleName; branchId: string | null }>;
  permissions: Permission[];
}

/**
 * Flattens a user's UserRole -> RolePermission grants into the shape the
 * frontends (web admin, POS) render RBAC UI from. `permissions` is a flat,
 * deduped union across all branch grants — good enough for hide/show UI;
 * the server re-checks branch-scoped grants on every request regardless
 * (see PermissionsGuard), so this view is never itself a security boundary.
 */
export async function buildAuthUser(prisma: PrismaService, userId: string): Promise<AuthUserView> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException("User not found");

  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const permissions = new Set<Permission>();
  const roles = userRoles.map((ur) => {
    for (const rp of ur.role.rolePermissions) permissions.add(rp.permission.code as Permission);
    return { role: ur.role.name as RoleName, branchId: ur.branchId };
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles,
    permissions: Array.from(permissions),
  };
}
