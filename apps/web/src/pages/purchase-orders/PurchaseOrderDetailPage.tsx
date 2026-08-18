import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  submitPurchaseOrder,
} from "@/api/purchase-orders";
import { createGoodsReceipt, type GoodsReceiptItemInput } from "@/api/goods-receipts";
import { PurchaseOrderStatus } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useHasPermission } from "@/hooks/useHasPermission";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

const STATUS_CLASSES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-amber-100 text-amber-700",
  PARTIALLY_RECEIVED: "bg-blue-100 text-blue-700",
  RECEIVED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

interface ReceivableItem {
  id: string;
  productVariantId: string;
  sku: string;
  label: string;
  outstanding: number;
  unitCost: number;
}

function ReceiveStockForm({
  items,
  branchId,
  purchaseOrderId,
  onSubmit,
  isPending,
}: {
  items: ReceivableItem[];
  branchId: string;
  purchaseOrderId: string;
  onSubmit: (input: { deliveryNoteRef?: string; items: GoodsReceiptItemInput[] }) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [deliveryNoteRef, setDeliveryNoteRef] = useState("");
  // Defaults each line's receive quantity to its remaining outstanding qty,
  // per the plan — the common case is receiving everything still owed.
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.id, i.outstanding])),
  );
  const [costs, setCosts] = useState<Record<string, number>>(
    Object.fromEntries(items.map((i) => [i.id, i.unitCost])),
  );

  const handleSubmit = () => {
    const receiptItems: GoodsReceiptItemInput[] = items
      .filter((i) => (quantities[i.id] ?? 0) > 0)
      .map((i) => ({
        purchaseOrderItemId: i.id,
        productVariantId: i.productVariantId,
        quantity: quantities[i.id] ?? 0,
        unitCost: costs[i.id] ?? i.unitCost,
      }));
    onSubmit({ deliveryNoteRef: deliveryNoteRef || undefined, items: receiptItems });
  };

  const anyOutstanding = items.some((i) => i.outstanding > 0);

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={t("purchaseOrders.detail.deliveryNoteRefLabel")}
        value={deliveryNoteRef}
        onChange={(e) => setDeliveryNoteRef(e.target.value)}
      />
      <div className="max-h-72 overflow-y-auto rounded-md border border-slate-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">{t("purchaseOrders.detail.itemColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("purchaseOrders.detail.outstandingLabel")}</th>
              <th className="px-3 py-2 font-medium">{t("purchaseOrders.detail.qtyReceivedLabel")}</th>
              <th className="px-3 py-2 font-medium">{t("purchaseOrders.detail.unitCostLabel")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <p className="font-mono text-xs text-slate-500">{item.sku}</p>
                </td>
                <td className="px-3 py-2 text-slate-600">{item.outstanding}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={item.outstanding}
                    value={quantities[item.id] ?? 0}
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                    }
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={costs[item.id] ?? 0}
                    onChange={(e) => setCosts((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!anyOutstanding && (
        <p className="text-xs text-slate-500">{t("purchaseOrders.detail.allReceivedNotice")}</p>
      )}
      <Button type="button" isLoading={isPending} disabled={!branchId || !purchaseOrderId} onClick={handleSubmit}>
        {t("purchaseOrders.detail.recordReceiptButton")}
      </Button>
    </div>
  );
}

export function PurchaseOrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canManage = useHasPermission("purchases.po.manage");
  const canReceive = useHasPermission("purchases.receive");
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);

  const poQuery = useQuery({ queryKey: ["purchase-orders", id], queryFn: () => getPurchaseOrder(id as string) });

  const submitMutation = useMutation({
    mutationFn: () => submitPurchaseOrder(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", id] });
      toast.success(t("purchaseOrders.detail.submitted"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseOrders.detail.submitToastFailed"))),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPurchaseOrder(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", id] });
      toast.success(t("purchaseOrders.detail.cancelled"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseOrders.detail.cancelToastFailed"))),
  });

  const receiveMutation = useMutation({
    mutationFn: (input: { deliveryNoteRef?: string; items: GoodsReceiptItemInput[] }) =>
      createGoodsReceipt({
        purchaseOrderId: id as string,
        branchId: poQuery.data?.branchId as string,
        deliveryNoteRef: input.deliveryNoteRef,
        items: input.items,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders", id] });
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      setReceiveModalOpen(false);
      toast.success(t("purchaseOrders.detail.receiptRecorded"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseOrders.detail.receiptFailed"))),
  });

  return (
    <DataState isLoading={poQuery.isLoading} isError={poQuery.isError} error={poQuery.error}>
      {poQuery.data && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)} className="mb-1 text-xs text-slate-500 underline">
                {t("purchaseOrders.detail.back")}
              </button>
              <h1 className="text-2xl font-bold text-slate-900">
                {t("purchaseOrders.detail.poTitle", { id: poQuery.data.id.slice(0, 8) })}
              </h1>
              <p className="text-sm text-slate-500">
                {poQuery.data.vendor?.name ?? poQuery.data.vendorId} · {poQuery.data.branch?.name ?? "—"} ·{" "}
                {new Date(poQuery.data.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                STATUS_CLASSES[poQuery.data.status] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {t(`purchaseOrders.statuses.${poQuery.data.status}`)}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("purchaseOrders.detail.itemColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("purchaseOrders.detail.orderedColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("purchaseOrders.detail.receivedColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("purchaseOrders.detail.outstandingColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("purchaseOrders.detail.unitCostColumn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {poQuery.data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-slate-900">
                      {item.variant?.product?.name ?? item.productVariantId} — {item.variant?.sku ?? ""}
                    </td>
                    <td className="px-4 py-2">{item.quantityOrdered}</td>
                    <td className="px-4 py-2">{item.quantityReceived}</td>
                    <td className="px-4 py-2 font-medium">
                      {Math.max(0, item.quantityOrdered - item.quantityReceived)}
                    </td>
                    <td className="px-4 py-2">{currency(item.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {poQuery.data.notes && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <span className="font-medium text-slate-700">{t("purchaseOrders.detail.notesLabel")}</span>
              {poQuery.data.notes}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {canManage && poQuery.data.status === PurchaseOrderStatus.DRAFT && (
              <Button isLoading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                {t("purchaseOrders.detail.submitToVendorButton")}
              </Button>
            )}
            {canReceive &&
              (poQuery.data.status === PurchaseOrderStatus.SUBMITTED ||
                poQuery.data.status === PurchaseOrderStatus.PARTIALLY_RECEIVED) && (
                <Button onClick={() => setReceiveModalOpen(true)}>{t("purchaseOrders.detail.receiveStockButton")}</Button>
              )}
            {canManage &&
              poQuery.data.status !== PurchaseOrderStatus.CANCELLED &&
              poQuery.data.status !== PurchaseOrderStatus.RECEIVED &&
              poQuery.data.items.every((i) => i.quantityReceived === 0) && (
                <Button variant="danger" isLoading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                  {t("purchaseOrders.detail.cancelPurchaseOrderButton")}
                </Button>
              )}
          </div>
          {submitMutation.isError && <p className="text-xs text-red-600">{t("purchaseOrders.detail.submitFailed")}</p>}
          {cancelMutation.isError && <p className="text-xs text-red-600">{t("purchaseOrders.detail.cancelFailed")}</p>}

          <Modal open={receiveModalOpen} onClose={() => setReceiveModalOpen(false)} title={t("purchaseOrders.detail.receiveStockModalTitle")}>
            <ReceiveStockForm
              purchaseOrderId={poQuery.data.id}
              branchId={poQuery.data.branchId}
              items={poQuery.data.items.map((item) => ({
                id: item.id,
                productVariantId: item.productVariantId,
                sku: item.variant?.sku ?? item.productVariantId,
                label: item.variant?.product?.name ?? item.productVariantId,
                outstanding: Math.max(0, item.quantityOrdered - item.quantityReceived),
                unitCost: item.unitCost,
              }))}
              isPending={receiveMutation.isPending}
              onSubmit={(input) => receiveMutation.mutate(input)}
            />
            {receiveMutation.isError && (
              <p className="mt-3 text-xs text-red-600">{t("purchaseOrders.detail.recordReceiptFailed")}</p>
            )}
          </Modal>
        </div>
      )}
    </DataState>
  );
}
