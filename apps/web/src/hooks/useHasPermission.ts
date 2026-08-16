import type { Permission, RoleName } from "@qassemiya/shared-types";
import { useAuthStore } from "@/store/authStore";

/**
 * Simple permission check against the roles/permissions the server returned
 * at login — enough for phase 1's "hide/disable what this user can't do" UI.
 * Not a generic policy engine; the server remains the source of truth and
 * re-checks every request regardless of what the UI shows.
 *
 * The Part-A vendor/purchasing permission keys (`vendors.manage`,
 * `purchases.po.manage`, `purchases.receive`, `purchases.invoice.manage`,
 * `purchases.payment.create`, `purchases.return.create`) aren't in
 * `@qassemiya/shared-types`' `PERMISSIONS`/`Permission` union yet — that file
 * is owned by the parallel apps/api build. The widened parameter type here
 * (`Permission | (string & {})`) lets callers pass those forward-compat
 * string literals with editor autocomplete still working for the known set,
 * without touching packages/shared-types. Once shared-types adds them, this
 * signature can be tightened back to `Permission`.
 */
export function useHasPermission(permission: Permission | (string & {})): boolean {
  return useAuthStore((s) => s.user?.permissions.includes(permission as Permission) ?? false);
}

export function useHasRole(...roles: RoleName[]): boolean {
  return useAuthStore((s) => !!s.user && s.user.roles.some((r) => roles.includes(r.role)));
}
