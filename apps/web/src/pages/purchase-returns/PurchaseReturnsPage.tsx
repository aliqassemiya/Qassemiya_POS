import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPurchaseOrder } from "@/api/purchase-orders";
import { createPurchaseReturn, listPurchaseReturns, type PurchaseReturnItemInput } from "@/api/purchase-returns";
import type { PurchaseOrder } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuthStore } from "@/store/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function NewPurchaseReturnForm({ onCreated }: { onCreated: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [selected, setSelected] = useState<Record<string, { quantity: number; creditAmount: number }>>({});
  const [reason, setReason] = useState("");

  const loadPoMutation = useMutation({
    mutationFn: () => getPurchaseOrder(purchaseOrderId),
    onSuccess: (data) => {
      setPo(data);
      setSelected({});
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: createPurchaseReturn,
    onSuccess: onCreated,
  });

  // Only items that have actually been received can be returned to the
  // vendor — quantityReceived is the ceiling, not quantityOrdered.
  const toggleItem = (itemId: string, unitCost: number, maxQty: number) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = { quantity: maxQty, creditAmount: unitCost * maxQty };
      }
      return next;
    });
  };

  const totalCreditAmount = Object.values(selected).reduce((sum, v) => sum + v.creditAmount, 0);

  const handleSubmit = () => {
    if (!po || !user) return;
    const items: PurchaseReturnItemInput[] = Object.entries(selected).map(([purchaseOrderItemId, v]) => ({
      purchaseOrderItemId,
      quantity: v.quantity,
      creditAmount: v.creditAmount,
    }));
    createReturnMutation.mutate({
      // Client-generated id, same convention ReturnsPage uses for its
      // sales-side return (crypto.randomUUID() stand-in for offline-sync
      // idempotency, which doesn't apply to this admin-only web flow).
      id: crypto.randomUUID(),
      purchaseOrderId: po.id,
      branchId: po.branchId,
      processedByUserId: user.id,
      reason: reason || undefined,
      items,
      totalCreditAmount,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <TextField label="Purchase order ID" value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} />
        <Button
          type="button"
          variant="secondary"
          isLoading={loadPoMutation.isPending}
          onClick={() => purchaseOrderId && loadPoMutation.mutate()}
        >
          Load PO
        </Button>
      </div>
      {loadPoMutation.isError && <p className="text-xs text-red-600">Purchase order not found.</p>}

      {po && (
        <>
          <p className="text-sm text-slate-600">
            {po.vendor?.name ?? po.vendorId} · {po.branch?.name ?? "—"}
          </p>
          <div className="max-h-64 overflow-y-auto rounded-md border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Qty received</th>
                  <th className="px-3 py-2 font-medium">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {po.items
                  .filter((item) => item.quantityReceived > 0)
                  .map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[item.id])}
                          onChange={() => toggleItem(item.id, item.unitCost, item.quantityReceived)}
                        />
                      </td>
                      <td className="px-3 py-2">{item.variant?.sku ?? item.productVariantId}</td>
                      <td className="px-3 py-2">{item.quantityReceived}</td>
                      <td className="px-3 py-2">{currency(item.unitCost * item.quantityReceived)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {po.items.every((item) => item.quantityReceived === 0) && (
              <p className="p-3 text-sm text-slate-500">
                Nothing has been received against this purchase order yet, so there is nothing to return.
              </p>
            )}
          </div>

          <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />

          <div className="flex items-center justify-between text-sm font-medium">
            <span>Total credit</span>
            <span>{currency(totalCreditAmount)}</span>
          </div>

          <Button
            type="button"
            isLoading={createReturnMutation.isPending}
            disabled={Object.keys(selected).length === 0}
            onClick={handleSubmit}
          >
            Create purchase return
          </Button>
          {createReturnMutation.isError && (
            <p className="text-xs text-red-600">Could not create the purchase return. Please try again.</p>
          )}
        </>
      )}
    </div>
  );
}

export function PurchaseReturnsPage() {
  const canCreate = useHasPermission("purchases.return.create");
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const returnsQuery = useQuery({ queryKey: ["purchase-returns"], queryFn: () => listPurchaseReturns() });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Purchase returns</h1>
        {canCreate && <Button onClick={() => setModalOpen(true)}>New purchase return</Button>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={returnsQuery.isLoading}
          isError={returnsQuery.isError}
          error={returnsQuery.error}
          isEmpty={(returnsQuery.data?.length ?? 0) === 0}
          emptyMessage="No purchase returns recorded yet."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Purchase order</th>
                <th className="px-4 py-2 font-medium">Reason</th>
                <th className="px-4 py-2 font-medium">Credit amount</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returnsQuery.data?.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-slate-600">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-600">{r.purchaseOrderId.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-slate-600">{r.reason ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{currency(r.totalCreditAmount)}</td>
                  <td className="px-4 py-2 text-slate-600">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New purchase return">
        <NewPurchaseReturnForm
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["purchase-returns"] });
            setModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
