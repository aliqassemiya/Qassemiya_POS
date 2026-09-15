import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { Permission } from "@qassemiya/shared-types";
import { useAuthStore } from "@/store/authStore";
import type { TranslationResource } from "@/i18n/en";

interface NavItem {
  to: string;
  labelKey: keyof TranslationResource["nav"];
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
  { to: "/dashboard", labelKey: "dashboard" },
  { to: "/branches", labelKey: "branches", anyOf: ["branches.manage"] },
  { to: "/products", labelKey: "products", anyOf: ["catalog.manage", "inventory.view"] },
  { to: "/inventory", labelKey: "inventory", anyOf: ["inventory.view", "inventory.adjust"] },
  { to: "/sales", labelKey: "sales", anyOf: ["pos.sale.create", "pos.sale.void", "reports.view"] },
  { to: "/returns", labelKey: "returns", anyOf: ["pos.return.create", "reports.view"] },
  { to: "/customers", labelKey: "customers", anyOf: ["customers.manage"] },
  { to: "/employees", labelKey: "employees", anyOf: ["employees.manage"] },
  { to: "/vendors", labelKey: "vendors", anyOf: ["vendors.manage"] },
  {
    to: "/purchase-orders",
    labelKey: "purchaseOrders",
    anyOf: ["purchases.po.manage", "purchases.receive"],
  },
  { to: "/purchase-invoices", labelKey: "purchaseInvoices", anyOf: ["purchases.invoice.manage"] },
  { to: "/purchase-returns", labelKey: "purchaseReturns", anyOf: ["purchases.return.create"] },
  { to: "/reports", labelKey: "reports", anyOf: ["reports.view"] },
];

// Finance & Accounting (spicy-kindling-puffin.md) — a separate nav section
// from the items above, gated by the new accounts.manage/journal.manage/
// expenses.manage/reports.financial.view permission keys. Not yet in
// @qassemiya/shared-types' PERMISSIONS/Permission union (the parallel apps/api
// build owns that file) — see the NavItem.anyOf widened type note below.
const FINANCE_NAV_ITEMS: NavItem[] = [
  { to: "/accounts", labelKey: "accounts", anyOf: ["accounts.manage"] },
  { to: "/journal-entries", labelKey: "journalEntries", anyOf: ["journal.manage", "reports.financial.view"] },
  { to: "/expenses", labelKey: "expenses", anyOf: ["expenses.manage"] },
  { to: "/reports/financial", labelKey: "financeReports", anyOf: ["reports.financial.view"] },
];

// Online sales reporting (Shopify sync data) — separate from the
// "Integrations" section below, which is for connecting/configuring a
// channel rather than viewing its data. Browsing/comparison reuse the
// existing reports permissions like every other report page does.
const ONLINE_SALES_NAV_ITEMS: NavItem[] = [
  { to: "/integrations/shopify/orders", labelKey: "onlineOrders", anyOf: ["reports.view"] },
  { to: "/reports/channel-comparison", labelKey: "channelComparison", anyOf: ["reports.channel.view"] },
];

// Connecting/configuring an external channel — each is SUPER_ADMIN-only
// (holds a live external credential).
const INTEGRATIONS_NAV_ITEMS: NavItem[] = [
  { to: "/integrations/shopify", labelKey: "shopifySettings", anyOf: ["integrations.shopify.manage"] },
  { to: "/integrations/whatsapp", labelKey: "whatsappSettings", anyOf: ["integrations.whatsapp.manage"] },
  { to: "/integrations/tamara", labelKey: "tamaraSettings", anyOf: ["integrations.tamara.manage"] },
];

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;

export function Sidebar() {
  const { t } = useTranslation();
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.anyOf || item.anyOf.some((p) => (permissions as string[]).includes(p)),
  );
  const visibleFinanceItems = FINANCE_NAV_ITEMS.filter(
    (item) => !item.anyOf || item.anyOf.some((p) => (permissions as string[]).includes(p)),
  );
  const visibleOnlineSalesItems = ONLINE_SALES_NAV_ITEMS.filter(
    (item) => !item.anyOf || item.anyOf.some((p) => (permissions as string[]).includes(p)),
  );
  const visibleIntegrationsItems = INTEGRATIONS_NAV_ITEMS.filter(
    (item) => !item.anyOf || item.anyOf.some((p) => (permissions as string[]).includes(p)),
  );

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4">
      <div className="mb-4 px-2 text-lg font-bold text-slate-900">{t("nav.brand")}</div>
      {visibleItems.map((item) => (
        <NavLink key={item.to} to={item.to} className={linkClasses}>
          {t(`nav.${item.labelKey}`)}
        </NavLink>
      ))}
      {visibleFinanceItems.length > 0 && (
        <>
          <div className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("nav.financeSection")}
          </div>
          {visibleFinanceItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClasses}>
              {t(`nav.${item.labelKey}`)}
            </NavLink>
          ))}
        </>
      )}
      {visibleOnlineSalesItems.length > 0 && (
        <>
          <div className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("nav.onlineSalesSection")}
          </div>
          {visibleOnlineSalesItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClasses}>
              {t(`nav.${item.labelKey}`)}
            </NavLink>
          ))}
        </>
      )}
      {visibleIntegrationsItems.length > 0 && (
        <>
          <div className="mb-1 mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t("nav.integrationsSection")}
          </div>
          {visibleIntegrationsItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClasses}>
              {t(`nav.${item.labelKey}`)}
            </NavLink>
          ))}
        </>
      )}
    </nav>
  );
}
