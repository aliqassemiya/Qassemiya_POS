import { NavLink } from "react-router-dom";
import type { Permission } from "@qassemiya/shared-types";
import { useAuthStore } from "@/store/authStore";

interface NavItem {
  to: string;
  label: string;
  /**
   * Shown if the user has ANY of these permissions; omit to always show.
   * Widened to accept forward-compat permission strings not yet in
   * @qassemiya/shared-types' `Permission` union — see the note in
   * hooks/useHasPermission.ts (vendors.manage, purchases.*.*, etc. are
   * added to shared-types by the parallel apps/api build).
   */
  anyOf?: (Permission | (string & {}))[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/branches", label: "Branches", anyOf: ["branches.manage"] },
  { to: "/products", label: "Products", anyOf: ["catalog.manage", "inventory.view"] },
  { to: "/inventory", label: "Inventory", anyOf: ["inventory.view", "inventory.adjust"] },
  { to: "/sales", label: "Sales", anyOf: ["pos.sale.create", "pos.sale.void", "reports.view"] },
  { to: "/returns", label: "Returns", anyOf: ["pos.return.create", "reports.view"] },
  { to: "/customers", label: "Customers", anyOf: ["customers.manage"] },
  { to: "/employees", label: "Employees", anyOf: ["employees.manage"] },
  { to: "/vendors", label: "Vendors", anyOf: ["vendors.manage"] },
  {
    to: "/purchase-orders",
    label: "Purchase orders",
    anyOf: ["purchases.po.manage", "purchases.receive"],
  },
  { to: "/purchase-invoices", label: "Purchase invoices", anyOf: ["purchases.invoice.manage"] },
  { to: "/purchase-returns", label: "Purchase returns", anyOf: ["purchases.return.create"] },
  { to: "/reports", label: "Reports", anyOf: ["reports.view"] },
];

// Finance & Accounting (spicy-kindling-puffin.md) — a separate nav section
// from the items above, gated by the new accounts.manage/journal.manage/
// expenses.manage/reports.financial.view permission keys. Not yet in
// @qassemiya/shared-types' PERMISSIONS/Permission union (the parallel apps/api
// build owns that file) — see the NavItem.anyOf widened type note below.
const FINANCE_NAV_ITEMS: NavItem[] = [
  { to: "/accounts", label: "Chart of accounts", anyOf: ["accounts.manage"] },
  { to: "/journal-entries", label: "Journal entries", anyOf: ["journal.manage", "reports.financial.view"] },
  { to: "/expenses", label: "Expenses", anyOf: ["expenses.manage"] },
  { to: "/reports/financial", label: "Finance reports", anyOf: ["reports.financial.view"] },
];

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;

export function Sidebar() {
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.anyOf || item.anyOf.some((p) => (permissions as string[]).includes(p)),
  );
  const visibleFinanceItems = FINANCE_NAV_ITEMS.filter(
    (item) => !item.anyOf || item.anyOf.some((p) => (permissions as string[]).includes(p)),
  );

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4">
      <div className="mb-4 px-2 text-lg font-bold text-slate-900">Qassemiya</div>
      {visibleItems.map((item) => (
        <NavLink key={item.to} to={item.to} className={linkClasses}>
          {item.label}
        </NavLink>
      ))}
      {visibleFinanceItems.length > 0 && (
        <>
          <div className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Finance
          </div>
          {visibleFinanceItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClasses}>
              {item.label}
            </NavLink>
          ))}
        </>
      )}
    </nav>
  );
}
