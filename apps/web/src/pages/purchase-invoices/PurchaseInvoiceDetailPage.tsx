import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { listPaymentMethods } from "@/api/paymentMethods";
import { cancelPurchaseInvoice, getPurchaseInvoice } from "@/api/purchase-invoices";
import { createVendorPayment, listVendorPayments } from "@/api/vendor-payments";
import { PurchaseInvoiceStatus } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useHasPermission } from "@/hooks/useHasPermission";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PARTIALLY_PAID: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

// No shared-types schema exists for VendorPayment yet — see the note atop
// api/vendor-payments.ts.
function buildPaymentSchema(t: (key: string) => string) {
  return z.object({
    amount: z.coerce.number().positive(t("purchaseInvoices.detail.amountPositive")),
    paymentMethodId: z.string().min(1, t("purchaseInvoices.detail.paymentMethodRequired")),
    referenceNumber: z.string().optional(),
  });
}

function RecordPaymentForm({
  vendorId,
  purchaseInvoiceId,
  onRecorded,
}: {
  vendorId: string;
  purchaseInvoiceId: string;
  onRecorded: () => void;
}) {
  const { t } = useTranslation();
  const paymentMethodsQuery = useQuery({ queryKey: ["payment-methods"], queryFn: listPaymentMethods });

  const paymentSchema = useMemo(() => buildPaymentSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ amount: number; paymentMethodId: string; referenceNumber?: string }>({
    resolver: zodResolver(paymentSchema),
  });

  const payMutation = useMutation({
    mutationFn: (input: { amount: number; paymentMethodId: string; referenceNumber?: string }) =>
      createVendorPayment({ vendorId, purchaseInvoiceId, ...input }),
    onSuccess: () => {
      onRecorded();
      toast.success(t("purchaseInvoices.detail.recorded"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseInvoices.detail.recordFailed"))),
  });

  return (
    <form onSubmit={handleSubmit((input) => payMutation.mutate(input))} className="flex flex-col gap-4">
      <TextField
        label={t("purchaseInvoices.detail.amountLabel")}
        type="number"
        step="0.01"
        error={errors.amount}
        {...register("amount", { valueAsNumber: true })}
      />
      <SelectField label={t("purchaseInvoices.detail.paymentMethodLabel")} error={errors.paymentMethodId} {...register("paymentMethodId")}>
        <option value="">{t("purchaseInvoices.detail.selectPaymentMethodPlaceholder")}</option>
        {paymentMethodsQuery.data?.map((pm) => (
          <option key={pm.id} value={pm.id}>
            {pm.name}
          </option>
        ))}
      </SelectField>
      <TextField label={t("purchaseInvoices.detail.referenceNumberLabel")} error={errors.referenceNumber} {...register("referenceNumber")} />
      <Button type="submit" isLoading={payMutation.isPending}>
        {t("purchaseInvoices.detail.recordPaymentButtonSubmit")}
      </Button>
      {payMutation.isError && (
        <p className="text-xs text-red-600">{t("purchaseInvoices.detail.recordInlineError")}</p>
      )}
    </form>
  );
}

export function PurchaseInvoiceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canManage = useHasPermission("purchases.invoice.manage");
  const canPay = useHasPermission("purchases.payment.create");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const invoiceQuery = useQuery({
    queryKey: ["purchase-invoices", id],
    queryFn: () => getPurchaseInvoice(id as string),
  });

  const paymentsQuery = useQuery({
    queryKey: ["vendor-payments", "for-invoice", id],
    queryFn: () => listVendorPayments({ purchaseInvoiceId: id }),
    enabled: Boolean(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelPurchaseInvoice(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-invoices", id] });
      toast.success(t("purchaseInvoices.detail.cancelled"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseInvoices.detail.cancelFailed"))),
  });

  const totalPaid = paymentsQuery.data?.reduce((sum, p) => sum + p.amount, 0) ?? 0;

  return (
    <DataState isLoading={invoiceQuery.isLoading} isError={invoiceQuery.isError} error={invoiceQuery.error}>
      {invoiceQuery.data && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)} className="mb-1 text-xs text-slate-500 underline">
                {t("purchaseInvoices.detail.back")}
              </button>
              <h1 className="text-2xl font-bold text-slate-900">
                {t("purchaseInvoices.detail.invoiceTitle", { invoiceNumber: invoiceQuery.data.invoiceNumber })}
              </h1>
              <p className="text-sm text-slate-500">
                {invoiceQuery.data.vendor?.name ?? invoiceQuery.data.vendorId} ·{" "}
                {new Date(invoiceQuery.data.invoiceDate).toLocaleDateString()}
                {invoiceQuery.data.dueDate
                  ? t("purchaseInvoices.detail.dueDateSuffix", {
                      date: new Date(invoiceQuery.data.dueDate).toLocaleDateString(),
                    })
                  : ""}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                STATUS_CLASSES[invoiceQuery.data.status] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {t(`purchaseInvoices.statuses.${invoiceQuery.data.status}`)}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t("purchaseInvoices.detail.totalsTitle")}</h2>
              <div className="flex justify-between py-1">
                <span>{t("purchaseInvoices.detail.subtotalLabel")}</span>
                <span>{currency(invoiceQuery.data.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>{t("purchaseInvoices.detail.taxLabel")}</span>
                <span>{currency(invoiceQuery.data.taxTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 py-1 font-semibold">
                <span>{t("purchaseInvoices.detail.totalLabel")}</span>
                <span>{currency(invoiceQuery.data.total)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>{t("purchaseInvoices.detail.paidToDateLabel")}</span>
                <span>{currency(totalPaid)}</span>
              </div>
              <div className="flex justify-between py-1 font-medium text-slate-900">
                <span>{t("purchaseInvoices.detail.remainingLabel")}</span>
                <span>{currency(Math.max(0, invoiceQuery.data.total - totalPaid))}</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t("purchaseInvoices.detail.paymentsTitle")}</h2>
              <DataState
                isLoading={paymentsQuery.isLoading}
                isError={paymentsQuery.isError}
                error={paymentsQuery.error}
                isEmpty={(paymentsQuery.data?.length ?? 0) === 0}
                emptyMessage={t("purchaseInvoices.detail.emptyPayments")}
              >
                <ul className="divide-y divide-slate-100 text-sm">
                  {paymentsQuery.data?.map((p) => (
                    <li key={p.id} className="flex justify-between py-1">
                      <span>
                        {new Date(p.paidAt).toLocaleDateString()} · {p.paymentMethod?.name ?? p.paymentMethodId}
                      </span>
                      <span className="font-medium">{currency(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </DataState>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {canPay && invoiceQuery.data.status !== PurchaseInvoiceStatus.PAID && invoiceQuery.data.status !== PurchaseInvoiceStatus.CANCELLED && (
              <Button onClick={() => setPaymentModalOpen(true)}>{t("purchaseInvoices.detail.recordPaymentButton")}</Button>
            )}
            {canManage &&
              invoiceQuery.data.status !== PurchaseInvoiceStatus.CANCELLED &&
              invoiceQuery.data.status !== PurchaseInvoiceStatus.PAID && (
                <Button variant="danger" isLoading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                  {t("purchaseInvoices.detail.cancelInvoiceButton")}
                </Button>
              )}
          </div>
          {cancelMutation.isError && (
            <p className="text-xs text-red-600">{t("purchaseInvoices.detail.cancelInlineError")}</p>
          )}

          <Modal
            open={paymentModalOpen}
            onClose={() => setPaymentModalOpen(false)}
            title={t("purchaseInvoices.detail.recordPaymentModalTitle")}
          >
            <RecordPaymentForm
              vendorId={invoiceQuery.data.vendorId}
              purchaseInvoiceId={invoiceQuery.data.id}
              onRecorded={() => {
                queryClient.invalidateQueries({ queryKey: ["purchase-invoices", id] });
                queryClient.invalidateQueries({ queryKey: ["vendor-payments"] });
                setPaymentModalOpen(false);
              }}
            />
          </Modal>
        </div>
      )}
    </DataState>
  );
}
