import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listBranches } from "@/api/branches";
import { listVendors } from "@/api/vendors";
import { listPurchaseOrders } from "@/api/purchase-orders";
import { PurchaseOrderStatus } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { useAuthStore } from "@/store/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-amber-100 text-amber-700",
  PARTIALLY_RECEIVED: "bg-blue-100 text-blue-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export function PurchaseOrdersPage() {
  const canManage = useHasPermission("purchases.po.manage");
  const activeBranchId = useAuthStore((s) => s.activeBranchId);

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listVendors() });

  const [vendorId, setVendorId] = useState("");
  const [branchId, setBranchId] = useState(activeBranchId ?? "");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const poQuery = useQuery({
    queryKey: ["purchase-orders", vendorId, branchId, status, from, to],
    queryFn: () =>
      listPurchaseOrders({
        vendorId: vendorId || undefined,
        branchId: branchId || undefined,
        status: (status || undefined) as (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus] | undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Purchase orders</h1>
        {canManage && (
          <Link
            to="/purchase-orders/new"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            New purchase order
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All vendors</option>
          {vendorsQuery.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All branches</option>
          {branchesQuery.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All statuses</option>
          {Object.values(PurchaseOrderStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={poQuery.isLoading}
          isError={poQuery.isError}
          error={poQuery.error}
          isEmpty={(poQuery.data?.length ?? 0) === 0}
          emptyMessage="No purchase orders match your filters."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Branch</th>
                <th className="px-4 py-2 font-medium">Items</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {poQuery.data?.map((po) => (
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
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/purchase-orders/${po.id}`} className="text-sm font-medium text-slate-900 underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  );
}
