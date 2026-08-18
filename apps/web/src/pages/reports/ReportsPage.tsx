import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listBranches } from "@/api/branches";
import { listVendors } from "@/api/vendors";
import { getSalesSummary, getVendorBalancesReport, getVendorPerformanceReport } from "@/api/reports";
import { DataState } from "@/components/ui/DataState";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { useAuthStore } from "@/store/authStore";
import { endOfDayIso } from "@/lib/dateRange";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { t } = useTranslation();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [branchId, setBranchId] = useState(activeBranchId ?? "");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));

  const summaryQuery = useQuery({
    queryKey: ["reports", "sales-summary", branchId, from, to],
    queryFn: () =>
      getSalesSummary({
        branchId: branchId || undefined,
        from: new Date(from).toISOString(),
        to: endOfDayIso(to),
      }),
  });

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listVendors() });
  const [vendorId, setVendorId] = useState("");

  const vendorPerformanceQuery = useQuery({
    queryKey: ["reports", "vendor-performance", vendorId, branchId, from, to],
    queryFn: () =>
      getVendorPerformanceReport({
        vendorId: vendorId || undefined,
        branchId: branchId || undefined,
        from: new Date(from).toISOString(),
        to: endOfDayIso(to),
      }),
  });

  const vendorBalancesQuery = useQuery({
    queryKey: ["reports", "vendor-balances", vendorId],
    queryFn: () => getVendorBalancesReport({ vendorId: vendorId || undefined }),
  });

  const salesSummaryRows = summaryQuery.data
    ? [
        {
          from: summaryQuery.data.from,
          to: summaryQuery.data.to,
          orderCount: summaryQuery.data.orderCount,
          subtotal: summaryQuery.data.subtotal,
          discountTotal: summaryQuery.data.discountTotal,
          taxTotal: summaryQuery.data.taxTotal,
          total: summaryQuery.data.total,
        },
      ]
    : [];

  const vendorPerformanceRows = (vendorPerformanceQuery.data?.byVendor ?? []).map((row) => ({
    vendor: row.vendorName,
    unitsSold: row.unitsSold,
    revenue: row.revenue,
    cost: row.cost,
    profit: row.profit,
  }));

  const vendorBalanceRows = (vendorBalancesQuery.data ?? []).map((row) => ({
    vendor: row.vendorName,
    totalInvoiced: row.totalInvoiced,
    totalPaid: row.totalPaid,
    totalReturnCredits: row.totalReturnCredits,
    outstanding: row.outstanding,
  }));

  const salesSummaryHeaders = {
    from: t("common.from"),
    to: t("common.to"),
    orderCount: t("reports.ordersLabel"),
    subtotal: t("reports.subtotalLabel"),
    discountTotal: t("reports.discountLabel"),
    taxTotal: t("reports.taxLabel"),
    total: t("common.total"),
  };
  const vendorPerformanceHeaders = {
    vendor: t("reports.vendorColumn"),
    unitsSold: t("reports.unitsSoldColumn"),
    revenue: t("reports.revenueColumn"),
    cost: t("reports.costColumn"),
    profit: t("reports.profitColumn"),
  };
  const vendorBalanceHeaders = {
    vendor: t("reports.vendorColumn"),
    totalInvoiced: t("reports.invoicedColumn"),
    totalPaid: t("reports.paidColumn"),
    totalReturnCredits: t("reports.returnCreditsColumn"),
    outstanding: t("reports.outstandingColumn"),
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("reports.title")}</h1>

      <div className="flex flex-wrap items-end gap-3">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("common.allBranches")}</option>
          {branchesQuery.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("reports.allVendorsOption")}</option>
          {vendorsQuery.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("common.from")}</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("common.to")}</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{t("reports.salesSummaryTitle")}</h2>
          <ExportMenu
            disabled={!summaryQuery.data}
            filename={`sales-summary-${from}-to-${to}`}
            sheetName="Sales summary"
            rows={salesSummaryRows}
            headers={salesSummaryHeaders}
          />
        </div>
        <DataState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError} error={summaryQuery.error}>
          {summaryQuery.data && (
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-slate-500">{t("reports.ordersLabel")}</p>
                <p className="text-lg font-semibold text-slate-900">{summaryQuery.data.orderCount}</p>
              </div>
              <div>
                <p className="text-slate-500">{t("reports.subtotalLabel")}</p>
                <p className="text-lg font-semibold text-slate-900">{currency(summaryQuery.data.subtotal)}</p>
              </div>
              <div>
                <p className="text-slate-500">{t("reports.taxLabel")}</p>
                <p className="text-lg font-semibold text-slate-900">{currency(summaryQuery.data.taxTotal)}</p>
              </div>
              <div>
                <p className="text-slate-500">{t("common.total")}</p>
                <p className="text-lg font-semibold text-slate-900">{currency(summaryQuery.data.total)}</p>
              </div>
            </div>
          )}
        </DataState>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{t("reports.vendorPerformanceTitle")}</h2>
          <ExportMenu
            disabled={vendorPerformanceRows.length === 0}
            filename={`vendor-performance-${from}-to-${to}`}
            sheetName="Vendor performance"
            rows={vendorPerformanceRows}
            headers={vendorPerformanceHeaders}
          />
        </div>
        <DataState
          isLoading={vendorPerformanceQuery.isLoading}
          isError={vendorPerformanceQuery.isError}
          error={vendorPerformanceQuery.error}
          isEmpty={(vendorPerformanceQuery.data?.byVendor.length ?? 0) === 0}
          emptyMessage={t("reports.emptyVendorPerformance")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">{t("reports.vendorColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.unitsSoldColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.revenueColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.costColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.profitColumn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorPerformanceQuery.data?.byVendor.map((row) => (
                <tr key={row.vendorId}>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.vendorName}</td>
                  <td className="px-3 py-2">{row.unitsSold}</td>
                  <td className="px-3 py-2">{currency(row.revenue)}</td>
                  <td className="px-3 py-2">{currency(row.cost)}</td>
                  <td className="px-3 py-2 font-medium text-green-700">{currency(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">{t("reports.vendorBalancesTitle")}</h2>
          <ExportMenu
            disabled={vendorBalanceRows.length === 0}
            filename={`vendor-balances-${isoDate(new Date())}`}
            sheetName="Vendor balances"
            rows={vendorBalanceRows}
            headers={vendorBalanceHeaders}
          />
        </div>
        <DataState
          isLoading={vendorBalancesQuery.isLoading}
          isError={vendorBalancesQuery.isError}
          error={vendorBalancesQuery.error}
          isEmpty={(vendorBalancesQuery.data?.length ?? 0) === 0}
          emptyMessage={t("reports.emptyVendorBalances")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">{t("reports.vendorColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.invoicedColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.paidColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.returnCreditsColumn")}</th>
                <th className="px-3 py-2 font-medium">{t("reports.outstandingColumn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorBalancesQuery.data?.map((row) => (
                <tr key={row.vendorId}>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.vendorName}</td>
                  <td className="px-3 py-2">{currency(row.totalInvoiced)}</td>
                  <td className="px-3 py-2">{currency(row.totalPaid)}</td>
                  <td className="px-3 py-2">{currency(row.totalReturnCredits)}</td>
                  <td className={`px-3 py-2 font-medium ${row.outstanding > 0 ? "text-red-600" : "text-slate-900"}`}>
                    {currency(row.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </section>
    </div>
  );
}
