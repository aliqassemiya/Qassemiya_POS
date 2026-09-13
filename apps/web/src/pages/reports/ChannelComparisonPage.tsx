import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listBranches } from "@/api/branches";
import { getChannelComparison } from "@/api/reports";
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

export function ChannelComparisonPage() {
  const { t } = useTranslation();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [branchId, setBranchId] = useState(activeBranchId ?? "");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));

  const comparisonQuery = useQuery({
    queryKey: ["reports", "channel-comparison", branchId, from, to],
    queryFn: () =>
      getChannelComparison({
        branchId: branchId || undefined,
        from: new Date(from).toISOString(),
        to: endOfDayIso(to),
      }),
  });

  const bySkuRows = (comparisonQuery.data?.bySku ?? []).map((row) => ({
    sku: row.sku,
    productName: row.productName,
    inStoreQuantity: row.inStoreQuantity,
    inStoreRevenue: row.inStoreRevenue,
    onlineQuantity: row.onlineQuantity,
    onlineRevenue: row.onlineRevenue,
  }));

  const unmatchedRows = (comparisonQuery.data?.unmatchedShopifySkus ?? []).map((row) => ({
    sku: row.sku ?? "",
    title: row.title,
    quantity: row.quantity,
    revenue: row.revenue,
  }));

  const bySkuHeaders = {
    sku: t("shopify.skuColumn"),
    productName: t("common.name"),
    inStoreQuantity: t("channelComparison.inStoreQtyColumn"),
    inStoreRevenue: t("channelComparison.inStoreRevenueColumn"),
    onlineQuantity: t("channelComparison.onlineQtyColumn"),
    onlineRevenue: t("channelComparison.onlineRevenueColumn"),
  };
  const unmatchedHeaders = {
    sku: t("shopify.skuColumn"),
    title: t("common.name"),
    quantity: t("shopify.qtyColumn"),
    revenue: t("common.total"),
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("channelComparison.title")}</h1>

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

      <DataState isLoading={comparisonQuery.isLoading} isError={comparisonQuery.isError} error={comparisonQuery.error}>
        {comparisonQuery.data && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">
                  {t("channelComparison.inStoreLabel")}
                  {branchId && <span className="ml-1 text-xs text-slate-400">({t("channelComparison.branchScopedNote")})</span>}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{currency(comparisonQuery.data.inStore.total)}</p>
                <p className="text-xs text-slate-400">
                  {t("channelComparison.orderCountNote", { count: comparisonQuery.data.inStore.orderCount })}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">
                  {t("channelComparison.onlineLabel")}{" "}
                  <span className="text-xs text-slate-400">({t("channelComparison.companyWideNote")})</span>
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{currency(comparisonQuery.data.online.total)}</p>
                <p className="text-xs text-slate-400">
                  {t("channelComparison.orderCountNote", { count: comparisonQuery.data.online.orderCount })}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-500">{t("channelComparison.combinedLabel")}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{currency(comparisonQuery.data.combined)}</p>
              </div>
            </div>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">{t("channelComparison.bySkuTitle")}</h2>
                <ExportMenu
                  disabled={bySkuRows.length === 0}
                  filename={`channel-comparison-${from}-to-${to}`}
                  sheetName="Channel comparison"
                  rows={bySkuRows}
                  headers={bySkuHeaders}
                />
              </div>
              <DataState
                isLoading={false}
                isError={false}
                error={null}
                isEmpty={bySkuRows.length === 0}
                emptyMessage={t("channelComparison.bySkuEmpty")}
              >
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("shopify.skuColumn")}</th>
                      <th className="px-3 py-2 font-medium">{t("common.name")}</th>
                      <th className="px-3 py-2 font-medium">{t("channelComparison.inStoreQtyColumn")}</th>
                      <th className="px-3 py-2 font-medium">{t("channelComparison.inStoreRevenueColumn")}</th>
                      <th className="px-3 py-2 font-medium">{t("channelComparison.onlineQtyColumn")}</th>
                      <th className="px-3 py-2 font-medium">{t("channelComparison.onlineRevenueColumn")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparisonQuery.data.bySku.map((row) => (
                      <tr key={row.productVariantId}>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.sku}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{row.productName}</td>
                        <td className="px-3 py-2">{row.inStoreQuantity}</td>
                        <td className="px-3 py-2">{currency(row.inStoreRevenue)}</td>
                        <td className="px-3 py-2">{row.onlineQuantity}</td>
                        <td className="px-3 py-2">{currency(row.onlineRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataState>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">{t("channelComparison.unmatchedTitle")}</h2>
                <ExportMenu
                  disabled={unmatchedRows.length === 0}
                  filename={`unmatched-shopify-skus-${from}-to-${to}`}
                  sheetName="Unmatched SKUs"
                  rows={unmatchedRows}
                  headers={unmatchedHeaders}
                />
              </div>
              <DataState
                isLoading={false}
                isError={false}
                error={null}
                isEmpty={unmatchedRows.length === 0}
                emptyMessage={t("channelComparison.unmatchedEmpty")}
              >
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("shopify.skuColumn")}</th>
                      <th className="px-3 py-2 font-medium">{t("common.name")}</th>
                      <th className="px-3 py-2 font-medium">{t("shopify.qtyColumn")}</th>
                      <th className="px-3 py-2 font-medium">{t("common.total")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparisonQuery.data.unmatchedShopifySkus.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.sku ?? "—"}</td>
                        <td className="px-3 py-2 text-slate-900">{row.title}</td>
                        <td className="px-3 py-2">{row.quantity}</td>
                        <td className="px-3 py-2">{currency(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataState>
            </section>
          </div>
        )}
      </DataState>
    </div>
  );
}
