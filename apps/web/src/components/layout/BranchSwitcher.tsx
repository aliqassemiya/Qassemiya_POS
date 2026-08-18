import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { RoleName } from "@qassemiya/shared-types";
import { listBranches } from "@/api/branches";
import { useAuthStore } from "@/store/authStore";
import { useHasRole } from "@/hooks/useHasPermission";

/** Branch context switcher — only SUPER_ADMIN/BRANCH_MANAGER can change it, per the plan's RBAC design. */
export function BranchSwitcher() {
  const { t } = useTranslation();
  const canSwitch = useHasRole(RoleName.SUPER_ADMIN, RoleName.BRANCH_MANAGER);
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const setActiveBranch = useAuthStore((s) => s.setActiveBranch);
  const isSuperAdmin = useHasRole(RoleName.SUPER_ADMIN);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: listBranches,
    enabled: canSwitch,
    staleTime: 5 * 60_000,
  });

  if (!canSwitch || !user) return null;

  const managerBranchIds = new Set(
    user.roles.filter((r) => r.role === RoleName.BRANCH_MANAGER && r.branchId).map((r) => r.branchId as string),
  );
  const options = isSuperAdmin ? (branches ?? []) : (branches ?? []).filter((b) => managerBranchIds.has(b.id));

  if (options.length <= 1) return null;

  return (
    <select
      value={activeBranchId ?? ""}
      onChange={(e) => setActiveBranch(e.target.value || null)}
      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
      aria-label={t("common.activeBranchLabel")}
    >
      {options.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name}
        </option>
      ))}
    </select>
  );
}
