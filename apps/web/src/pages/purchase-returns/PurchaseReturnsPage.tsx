import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getPurchaseOrder } from "@/api/purchase-orders";
import { createPurchaseReturn, listPurchaseReturns, type PurchaseReturnItemInput } from "@/api/purchase-returns";
import type { PurchaseOrder } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Pagination } from "@/components/ui/Pagination";
import { useAuthStore } from "@/store/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";
import { randomUUID } from "@/lib/uuid";

const PAGE_SIZE = 20;

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function NewPurchaseReturnForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
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
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseReturns.form.poNotFoundError"))),
  });

  const createReturnMutation = useMutation({
    mutationFn: createPurchaseReturn,
    onSuccess: () => {
      onCreated();
      toast.success(t("purchaseReturns.created"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseReturns.createFailed"))),
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
      // sales-side return (randomUUID() stand-in for offline-sync
      // idempotency, which doesn't apply to this admin-only web flow).
      id: randomUUID(),
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
        <TextField
          label={t("purchaseReturns.form.purchaseOrderIdLabel")}
          value={purchaseOrderId}
          onChange={(e) => setPurchaseOrderId(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          isLoading={loadPoMutation.isPending}
          onClick={() => purchaseOrderId && loadPoMutation.mutate()}
        >
          {t("purchaseReturns.form.loadPoButton")}
        </Button>
      </div>
      {loadPoMutation.isError && <p className="text-xs text-red-600">{t("purchaseReturns.form.poNotFoundError")}</p>}

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
                  <th className="px-3 py-2 font-medium">{t("purchaseReturns.form.itemColumn")}</th>
                  <th className="px-3 py-2 font-medium">{t("purchaseReturns.form.qtyReceivedColumn")}</th>
                  <th className="px-3 py-2 font-medium">{t("purchaseReturns.form.creditColumn")}</th>
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
              <p className="p-3 text-sm text-slate-500">{t("purchaseReturns.form.nothingReceivedNotice")}</p>
            )}
          </div>

          <TextField label={t("purchaseReturns.form.reasonLabel")} value={reason} onChange={(e) => setReason(e.target.value)} />

          <div className="flex items-center justify-between text-sm font-medium">
            <span>{t("purchaseReturns.form.totalCreditLabel")}</span>
            <span>{currency(totalCreditAmount)}</span>
          </div>

          <Button
            type="button"
            isLoading={createReturnMutation.isPending}
            disabled={Object.keys(selected).length === 0}
            onClick={handleSubmit}
          >
            {t("purchaseReturns.form.createButton")}
          </Button>
          {createReturnMutation.isError && (
            <p className="text-xs text-red-600">{t("purchaseReturns.form.createInlineError")}</p>
          )}
        </>
      )}
    </div>
  );
}

export function PurchaseReturnsPage() {
  const { t } = useTranslation();
  const canCreate = useHasPermission("purchases.return.create");
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);

  const returnsQuery = useQuery({
    queryKey: ["purchase-returns", page],
    queryFn: () => listPurchaseReturns({ page, pageSize: PAGE_SIZE }),
  });
  const purchaseReturns = returnsQuery.data?.data ?? [];
  const totalCount = returnsQuery.data?.totalCount ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("purchaseReturns.title")}</h1>
        {canCreate && <Button onClick={() => setModalOpen(true)}>{t("purchaseReturns.newPurchaseReturn")}</Button>}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={returnsQuery.isLoading}
          isError={returnsQuery.isError}
          error={returnsQuery.error}
          isEmpty={purchaseReturns.length === 0}
          emptyMessage={t("purchaseReturns.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("purchaseReturns.dateColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseReturns.purchaseOrderColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseReturns.reasonColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseReturns.creditAmountColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchaseReturns.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-slate-600">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2 text-slate-600">{r.purchaseOrderId.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-slate-600">{r.reason ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{currency(r.totalCreditAmount)}</td>
                  <td className="px-4 py-2 text-slate-600">{t(`purchaseReturns.statuses.${r.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("purchaseReturns.newPurchaseReturn")}>
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
