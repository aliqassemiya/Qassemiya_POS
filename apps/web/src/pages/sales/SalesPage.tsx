import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listBranches } from "@/api/branches";
import { listSales } from "@/api/sales";
import { listPaymentMethods } from "@/api/paymentMethods";
import { DataState } from "@/components/ui/DataState";
import { useAuthStore } from "@/store/authStore";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

const STATUS_CLASSES: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  VOIDED: "bg-red-100 text-red-700",
  REFUNDED: "bg-amber-100 text-amber-700",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-700",
};

export function SalesPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const paymentMethodsQuery = useQuery({ queryKey: ["payment-methods"], queryFn: listPaymentMethods });
  const [branchId, setBranchId] = useState(activeBranchId ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const salesQuery = useQuery({
    queryKey: ["sales", branchId, paymentMethodId, from, to],
    queryFn: () =>
      listSales({
        branchId: branchId || undefined,
        paymentMethodId: paymentMethodId || undefined,
        from: from || undefined,
        to: to || undefined,
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-900">Sales</h1>

      <div className="flex flex-wrap items-end gap-3">
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
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All payment methods</option>
          {paymentMethodsQuery.data?.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.name}
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
          isLoading={salesQuery.isLoading}
          isError={salesQuery.isError}
          error={salesQuery.error}
          isEmpty={(salesQuery.data?.length ?? 0) === 0}
          emptyMessage="No sales match your filters."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Branch</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Payment</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesQuery.data?.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-2 text-slate-600">{new Date(order.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-600">{order.branch?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{order.source}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {order.payments?.map((p) => p.paymentMethod?.name ?? p.paymentMethodId).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">{currency(order.total)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[order.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/sales/${order.id}`} className="text-sm font-medium text-slate-900 underline">
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
