import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listBranches } from "@/api/branches";
import { listVendors } from "@/api/vendors";
import { listPurchaseOrders } from "@/api/purchase-orders";
import { PurchaseOrderStatus } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Pagination } from "@/components/ui/Pagination";
import { useAuthStore } from "@/store/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";

const PAGE_SIZE = 20;

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-amber-100 text-amber-700",
  PARTIALLY_RECEIVED: "bg-blue-100 text-blue-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export function PurchaseOrdersPage() {
  const { t } = useTranslation();
  const canManage = useHasPermission("purchases.po.manage");
  const activeBranchId = useAuthStore((s) => s.activeBranchId);

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listVendors() });

  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState(activeBranchId ?? "");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const poQuery = useQuery({
    queryKey: ["purchase-orders", vendorId, branchId, status, from, to, page],
    queryFn: () =>
      listPurchaseOrders({
        vendorId: vendorId || undefined,
        branchId: branchId || undefined,
        status: (status || undefined) as (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus] | undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
  });
  const purchaseOrders = poQuery.data?.data ?? [];
  const totalCount = poQuery.data?.totalCount ?? 0;

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("purchaseOrders.title")}</h1>
        {canManage && (
          <Link
            to="/purchase-orders/new"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            {t("purchaseOrders.newPurchaseOrder")}
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <select
          value={vendorId}
          onChange={(e) => resetToFirstPage(setVendorId)(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("purchaseOrders.allVendors")}</option>
          {vendorsQuery.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={branchId}
          onChange={(e) => resetToFirstPage(setBranchId)(e.target.value)}
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
          value={status}
          onChange={(e) => resetToFirstPage(setStatus)(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("purchaseOrders.allStatuses")}</option>
          {Object.values(PurchaseOrderStatus).map((s) => (
            <option key={s} value={s}>
              {t(`purchaseOrders.statuses.${s}`)}
            </option>
          ))}
        </select>
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
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={poQuery.isLoading}
          isError={poQuery.isError}
          error={poQuery.error}
          isEmpty={purchaseOrders.length === 0}
          emptyMessage={t("purchaseOrders.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("purchaseOrders.dateColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseOrders.vendorColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseOrders.branchColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseOrders.itemsColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.status")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseOrders.map((po) => (
                <tr key={po.id}>
                  <td className="px-4 py-2 text-slate-600">{new Date(po.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{po.vendor?.name ?? po.vendorId}</td>
                  <td className="px-4 py-2 text-slate-600">{po.branch?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{po.items.length}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_CLASSES[po.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {t(`purchaseOrders.statuses.${po.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/purchase-orders/${po.id}`} className="text-sm font-medium text-slate-900 underline">
                      {t("common.view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
    </div>
  );
}
