import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Permission } from "@qassemiya/shared-types";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import type { AuthenticatedUser } from "../types/auth-request";

/**
 * Resolves UserRole -> RolePermission grants (flattened onto the JWT at
 * login) scoped to the request's branch. A grant with branchId=null is
 * global and satisfies any branch. The request's effective branch is taken
 * from (in order): route param, query, body, or — for POS tokens — the
 * device's fixed paired branch.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new ForbiddenException("Not authenticated");

    const branchId: string | undefined =
      request.params?.branchId ?? request.query?.branchId ?? request.body?.branchId ?? user.deviceBranchId;

    const hasPermission = user.grants.some((grant) => {
      const branchMatches = grant.branchId === null || (branchId !== undefined && grant.branchId === branchId);
      if (!branchMatches) return false;
      return required.some((perm) => grant.permissions.includes(perm));
    });

    if (!hasPermission) {
      throw new ForbiddenException(`Missing required permission: ${required.join(" or ")}`);
    }
    return true;
  }
}
