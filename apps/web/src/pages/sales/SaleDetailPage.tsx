import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getSale, voidSale } from "@/api/sales";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { useHasPermission } from "@/hooks/useHasPermission";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canVoid = useHasPermission("pos.sale.void");
  const [reason, setReason] = useState("");

  const saleQuery = useQuery({ queryKey: ["sales", id], queryFn: () => getSale(id as string) });

  const voidMutation = useMutation({
    mutationFn: () => voidSale(id as string, reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales", id] });
    },
  });

  return (
    <DataState isLoading={saleQuery.isLoading} isError={saleQuery.isError} error={saleQuery.error}>
      {saleQuery.data && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)} className="mb-1 text-xs text-slate-500 underline">
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-slate-900">Order #{saleQuery.data.id.slice(0, 8)}</h1>
              <p className="text-sm text-slate-500">
                {new Date(saleQuery.data.createdAt).toLocaleString()} · {saleQuery.data.branch?.name ?? "—"} ·{" "}
                {saleQuery.data.source}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {saleQuery.data.status}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Qty</th>
                  <th className="px-4 py-2 font-medium">Unit price</th>
                  <th className="px-4 py-2 font-medium">Discount</th>
                  <th className="px-4 py-2 font-medium">Tax</th>
                  <th className="px-4 py-2 font-medium">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {saleQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-slate-900">
                      {item.variant?.product?.name ?? item.productVariantId} — {item.variant?.sku ?? ""}
                    </td>
                    <td className="px-4 py-2">{item.quantity}</td>
                    <td className="px-4 py-2">{currency(item.unitPrice)}</td>
                    <td className="px-4 py-2">{currency(item.discountAmount)}</td>
                    <td className="px-4 py-2">{currency(item.taxAmount)}</td>
                    <td className="px-4 py-2 font-medium">{currency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Payments</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {saleQuery.data.payments.map((p) => (
                  <li key={p.id} className="flex justify-between py-1">
                    <span>{p.paymentMethod?.name ?? p.paymentMethodId}</span>
                    <span className="font-medium">{currency(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Totals</h2>
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <span>{currency(saleQuery.data.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Discount</span>
                <span>-{currency(saleQuery.data.discountTotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Tax</span>
                <span>{currency(saleQuery.data.taxTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 py-1 font-semibold">
                <span>Total</span>
                <span>{currency(saleQuery.data.total)}</span>
              </div>
            </div>
          </div>

          {canVoid && saleQuery.data.status === "COMPLETED" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-red-800">Void this order</h2>
              <div className="flex gap-3">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="flex-1 rounded-md border border-red-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300"
                />
                <Button variant="danger" isLoading={voidMutation.isPending} onClick={() => voidMutation.mutate()}>
                  Void order
                </Button>
              </div>
              {voidMutation.isError && (
                <p className="mt-2 text-xs text-red-700">Could not void this order. Please try again.</p>
              )}
            </div>
          )}
        </div>
      )}
    </DataState>
  );
}
