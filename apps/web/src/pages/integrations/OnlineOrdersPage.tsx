import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listShopifyOrders, type ShopifyOrder } from "@/api/shopify";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 50;

function currency(n: number, code: string) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: code || "SAR" }).format(n);
}

export function OnlineOrdersPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ShopifyOrder | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["shopify", "orders", search, from, to, unmatchedOnly, page],
    queryFn: () =>
      listShopifyOrders({
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        unmatchedOnly: unmatchedOnly || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const totalCount = ordersQuery.data?.totalCount ?? 0;

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("shopify.onlineOrdersTitle")}</h1>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("common.search")}</label>
          <input
            type="text"
            value={search}
            onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
            placeholder={t("shopify.searchPlaceholder")}
            className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("common.from")}</label>
          <input
            type="date"
            value={from}
            onChange={(e) => resetToFirstPage(setFrom)(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">{t("common.to")}</label>
          <input
            type="date"
            value={to}
            onChange={(e) => resetToFirstPage(setTo)(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={unmatchedOnly}
            onChange={(e) => resetToFirstPage(setUnmatchedOnly)(e.target.checked)}
          />
          {t("shopify.unmatchedOnlyLabel")}
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={ordersQuery.isLoading}
          isError={ordersQuery.isError}
          error={ordersQuery.error}
          isEmpty={(ordersQuery.data?.orders.length ?? 0) === 0}
          emptyMessage={t("shopify.ordersEmpty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("shopify.orderNumberColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.date")}</th>
                <th className="px-4 py-2 font-medium">{t("shopify.financialStatusColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("shopify.itemsColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.total")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordersQuery.data?.orders.map((order) => {
                const unmatchedCount = order.items.filter((i) => !i.productVariantId).length;
                return (
                  <tr key={order.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">{order.orderNumber}</td>
                    <td className="px-4 py-2 text-slate-600">{new Date(order.shopifyCreatedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-slate-600">{order.financialStatus}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {order.items.length}
                      {unmatchedCount > 0 && (
                        <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {t("shopify.unmatchedBadge", { count: unmatchedCount })}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {currency(order.currentTotalPrice, order.currency)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" onClick={() => setSelected(order)}>
                        {t("common.view")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataState>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.orderNumber ?? ""}>
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">{t("common.date")}</p>
                <p className="font-medium text-slate-900">{new Date(selected.shopifyCreatedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500">{t("shopify.financialStatusColumn")}</p>
                <p className="font-medium text-slate-900">{selected.financialStatus}</p>
              </div>
              {selected.cancelledAt && (
                <div>
                  <p className="text-slate-500">{t("shopify.cancelledAtLabel")}</p>
                  <p className="font-medium text-red-600">{new Date(selected.cancelledAt).toLocaleString()}</p>
                </div>
              )}
            </div>

            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("shopify.customerTitle")}
              </p>
              {selected.customerName || selected.customerPhone || selected.customerEmail ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-slate-500">{t("common.name")}</p>
                    <p className="font-medium text-slate-900">{selected.customerName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">{t("common.phone")}</p>
                    <p className="font-medium text-slate-900" dir="ltr">
                      {selected.customerPhone ?? "—"}
                    </p>
                  </div>
                  {selected.customerEmail && (
                    <div className="col-span-2">
                      <p className="text-slate-500">{t("common.email")}</p>
                      <p className="font-medium text-slate-900" dir="ltr">
                        {selected.customerEmail}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("shopify.noCustomerInfo")}</p>
              )}
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1 font-medium">{t("shopify.skuColumn")}</th>
                  <th className="px-2 py-1 font-medium">{t("common.name")}</th>
                  <th className="px-2 py-1 font-medium">{t("shopify.qtyColumn")}</th>
                  <th className="px-2 py-1 font-medium">{t("common.total")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selected.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-1 font-mono text-xs text-slate-600">
                      {item.sku ?? "—"}
                      {!item.productVariantId && (
                        <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {t("shopify.unmatchedTag")}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-slate-900">{item.title}</td>
                    <td className="px-2 py-1 text-slate-600">{item.quantity}</td>
                    <td className="px-2 py-1 text-slate-600">{currency(item.lineTotal, selected.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex flex-col gap-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">
                  {t("shopify.subtotalLabel")} · {t("shopify.itemsCountNote", { count: selected.items.length })}
                </span>
                <span className="text-slate-900">{currency(selected.subtotalPrice, selected.currency)}</span>
              </div>
              {selected.totalDiscounts > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {t("shopify.discountLabel")}
                    {selected.discountCodes ? ` · ${selected.discountCodes}` : ""}
                  </span>
                  <span className="text-green-700">-{currency(selected.totalDiscounts, selected.currency)}</span>
                </div>
              )}
              {selected.totalShipping > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{selected.shippingTitle ?? t("shopify.shippingLabel")}</span>
                  <span className="text-slate-900">{currency(selected.totalShipping, selected.currency)}</span>
                </div>
              )}
              {selected.totalTax > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {t("shopify.taxesLabel")}
                    {selected.taxRate != null ? ` · VAT ${(selected.taxRate * 100).toFixed(0)}%` : ""}
                    {selected.taxesIncluded ? ` · ${t("shopify.taxIncludedLabel")}` : ""}
                  </span>
                  <span className="text-slate-900">{currency(selected.totalTax, selected.currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900">
                <span>{t("common.total")}</span>
                <span>{currency(selected.currentTotalPrice, selected.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>{t("shopify.paidLabel")}</span>
                <span>{currency(selected.currentTotalPrice - selected.totalOutstanding, selected.currency)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
