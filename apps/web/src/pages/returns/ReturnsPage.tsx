import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateReturnInput, ReturnItemInput } from "@qassemiya/shared-types";
import { listReturns, createReturn } from "@/api/returns";
import { getSale } from "@/api/sales";
import { listPaymentMethods } from "@/api/paymentMethods";
import type { Order } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useAuthStore } from "@/store/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function NewReturnForm({ onCreated }: { onCreated: () => void }) {
  const user = useAuthStore((s) => s.user);
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [selected, setSelected] = useState<Record<string, { quantity: number; refundAmount: number }>>({});
  const [reason, setReason] = useState("");
  const [refundPaymentMethodId, setRefundPaymentMethodId] = useState("");

  const paymentMethodsQuery = useQuery({ queryKey: ["payment-methods"], queryFn: listPaymentMethods });

  const loadOrderMutation = useMutation({
    mutationFn: () => getSale(orderId),
    onSuccess: (data) => {
      setOrder(data);
      setSelected({});
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: createReturn,
    onSuccess: onCreated,
  });

  const toggleItem = (itemId: string, unitPrice: number, maxQty: number) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = { quantity: maxQty, refundAmount: unitPrice * maxQty };
      }
      return next;
    });
  };

  const totalRefundAmount = Object.values(selected).reduce((sum, v) => sum + v.refundAmount, 0);

  const handleSubmit = () => {
    if (!order || !user || !refundPaymentMethodId) return;
    const items: ReturnItemInput[] = Object.entries(selected).map(([orderItemId, v]) => ({
      orderItemId,
      quantity: v.quantity,
      refundAmount: v.refundAmount,
      restocked: true,
    }));
    const input: CreateReturnInput = {
      // Client-generated id, same UUIDv7-for-idempotency pattern the plan uses
      // for POS-created rows; crypto.randomUUID() (v4) is a pragmatic stand-in
      // here since the web app isn't part of the offline-sync path.
      id: crypto.randomUUID(),
      orderId: order.id,
      branchId: order.branchId,
      processedByUserId: user.id,
      // Required so the return's GL posting knows which account to credit
      // the refund out of (Finance & Accounting module).
      refundPaymentMethodId,
      reason: reason || undefined,
      items,
      totalRefundAmount,
    };
    createReturnMutation.mutate(input);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <TextField label="Order ID" value={orderId} onChange={(e) => setOrderId(e.target.value)} />
        <Button
          type="button"
          variant="secondary"
          isLoading={loadOrderMutation.isPending}
          onClick={() => orderId && loadOrderMutation.mutate()}
        >
          Load order
        </Button>
      </div>
      {loadOrderMutation.isError && <p className="text-xs text-red-600">Order not found.</p>}

      {order && (
        <>
          <div className="max-h-64 overflow-y-auto rounded-md border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Qty sold</th>
                  <th className="px-3 py-2 font-medium">Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[item.id])}
                        onChange={() => toggleItem(item.id, item.unitPrice, item.quantity)}
                      />
                    </td>
                    <td className="px-3 py-2">{item.variant?.sku ?? item.productVariantId}</td>
                    <td className="px-3 py-2">{item.quantity}</td>
                    <td className="px-3 py-2">{currency(item.unitPrice * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SelectField
            label="Refund method"
            value={refundPaymentMethodId}
            onChange={(e) => setRefundPaymentMethodId(e.target.value)}
          >
            <option value="">Select how the refund was paid out…</option>
            {paymentMethodsQuery.data?.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.name}
              </option>
            ))}
          </SelectField>

          <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />

          <div className="flex items-center justify-between text-sm font-medium">
            <span>Total refund</span>
            <span>{currency(totalRefundAmount)}</span>
          </div>

          <Button
            type="button"
            isLoading={createReturnMutation.isPending}
            disabled={Object.keys(selected).length === 0 || !refundPaymentMethodId}
            onClick={handleSubmit}
          >
            Create return
          </Button>
          {createReturnMutation.isError && (
            <p className="text-xs text-red-600">Could not create the return. Please try again.</p>
          )}
        </>
      )}
    </div>
  );
}

export function ReturnsPage() {
  const canCreate = useHasPermission("pos.return.create");
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const returnsQuery = useQuery({ queryKey: ["returns"], queryFn: () => listReturns() });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Returns</h1>
        {canCreate && <Button onClick={() => setModalOpen(true)}>New return</Button>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={returnsQuery.isLoading}
          isError={returnsQuery.isError}
          error={returnsQuery.error}
          isEmpty={(returnsQuery.data?.length ?? 0) === 0}
          emptyMessage="No returns recorded yet."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Order</th>
                <th className="px-4 py-2 font-medium">Reason</th>
                <th className="px-4 py-2 font-medium">Refund amount</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returnsQuery.data?.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-slate-600">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-600">{r.orderId.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-slate-600">{r.reason ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{currency(r.totalRefundAmount)}</td>
                  <td className="px-4 py-2 text-slate-600">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New return">
        <NewReturnForm
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["returns"] });
            setModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
