import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { listShopifyReturns, getShopifyReturn } from "@/api/shopifyReturns";
import { listBranches } from "@/api/branches";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 50;

// Public endpoints (same pattern as /invoices/:id) -- the id is an
// unguessable UUID, so a plain link works with no auth-header handling.
const apiBase = import.meta.env.VITE_API_URL as string;

export function OnlineReturnsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const branchNameById = new Map((branchesQuery.data ?? []).map((b) => [b.id, b.name]));

  const returnsQuery = useQuery({
    queryKey: ["shopify-returns", page],
    queryFn: () => listShopifyReturns({ page, pageSize: PAGE_SIZE }),
  });
  const returns = returnsQuery.data?.data ?? [];
  const totalCount = returnsQuery.data?.totalCount ?? 0;

  const detailQuery = useQuery({
    queryKey: ["shopify-returns", selectedId],
    queryFn: () => getShopifyReturn(selectedId as string),
    enabled: Boolean(selectedId),
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("onlineReturns.title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("onlineReturns.subtitle")}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={returnsQuery.isLoading}
          isError={returnsQuery.isError}
          error={returnsQuery.error}
          isEmpty={returns.length === 0}
          emptyMessage={t("onlineReturns.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("onlineReturns.dateColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("onlineReturns.orderColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("onlineReturns.branchColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("onlineReturns.itemsColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("onlineReturns.reasonColumn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelectedId(r.id)}
                >
                  <td className="px-4 py-2 text-slate-600">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-600">{r.shopifyOrder?.orderNumber ?? r.shopifyOrderId.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-slate-600">{branchNameById.get(r.branchId) ?? r.branchId.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.items.reduce((sum, i) => sum + i.quantity, 0)}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      <Modal open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title={t("onlineReturns.detailTitle")}>
        {detailQuery.isLoading && <p className="text-sm text-slate-500">…</p>}
        {detailQuery.data && (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {detailQuery.data.shopifyOrder?.orderNumber ?? detailQuery.data.shopifyOrderId.slice(0, 8)}
              </div>
              <div className="text-xs text-slate-500">{new Date(detailQuery.data.createdAt).toLocaleString()}</div>
              <div className="text-xs text-slate-500">
                {branchNameById.get(detailQuery.data.branchId) ?? detailQuery.data.branchId.slice(0, 8)}
              </div>
            </div>

            <div>
              <div className="mb-1 text-xs font-medium text-slate-500">{t("onlineReturns.detailItemsHeading")}</div>
              <div className="divide-y divide-slate-100 rounded-md border border-slate-100">
                {detailQuery.data.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium text-slate-900">{item.shopifyOrderItem?.title ?? item.shopifyOrderItemId.slice(0, 8)}</div>
                      {item.shopifyOrderItem?.sku && (
                        <div className="text-xs text-slate-400" dir="ltr">
                          {item.shopifyOrderItem.sku}
                        </div>
                      )}
                    </div>
                    <div className="text-slate-600">
                      {t("onlineReturns.qtyLabel")}: {item.quantity}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-slate-500">{t("onlineReturns.reasonLabel")}</div>
              <div className="text-sm text-slate-700">{detailQuery.data.reason ?? t("onlineReturns.noReason")}</div>
            </div>

            <div className="flex gap-2">
              <a
                className="flex-1 rounded-md border border-slate-200 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={`${apiBase}/shopify-returns/${detailQuery.data.id}/slip`}
                target="_blank"
                rel="noreferrer"
              >
                {t("onlineReturns.viewSlip")}
              </a>
              <a
                className="flex-1 rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-slate-800"
                href={`${apiBase}/shopify-returns/${detailQuery.data.id}/slip/pdf`}
              >
                {t("onlineReturns.downloadPdf")}
              </a>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
