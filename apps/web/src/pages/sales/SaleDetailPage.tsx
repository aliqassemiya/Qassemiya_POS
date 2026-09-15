import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { confirmPayment, getSale, voidSale } from "@/api/sales";
import { listWhatsAppMessageLogs, resendWhatsAppInvoice } from "@/api/whatsapp";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { useHasPermission } from "@/hooks/useHasPermission";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

const WHATSAPP_STATUS_CLASSES: Record<string, string> = {
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-slate-100 text-slate-600",
};

const PAYMENT_STATUS_CLASSES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-slate-100 text-slate-600",
};

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

export function SaleDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canVoid = useHasPermission("pos.sale.void");
  const canManageWhatsApp = useHasPermission("integrations.whatsapp.manage");
  const canConfirmPayment = useHasPermission("pos.payment.confirm");
  const [reason, setReason] = useState("");

  const saleQuery = useQuery({ queryKey: ["sales", id], queryFn: () => getSale(id as string) });
  const whatsappLogsQuery = useQuery({
    queryKey: ["whatsapp", "message-logs", id],
    queryFn: () => listWhatsAppMessageLogs(id as string),
  });

  const voidMutation = useMutation({
    mutationFn: () => voidSale(id as string, reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["sales", id] });
      toast.success(t("sales.detail.voided"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("sales.detail.voidFailed"))),
  });

  const resendMutation = useMutation({
    mutationFn: () => resendWhatsAppInvoice(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "message-logs", id] });
      toast.success(t("sales.detail.whatsappResent"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("sales.detail.whatsappResendFailed"))),
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: (paymentId: string) => confirmPayment(id as string, paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales", id] });
      toast.success(t("sales.detail.paymentConfirmed"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("sales.detail.paymentConfirmFailed"))),
  });

  const latestWhatsAppLog = whatsappLogsQuery.data?.[0];
  const invoiceUrl = id ? `${import.meta.env.VITE_API_URL}/invoices/${id}` : "";

  return (
    <DataState isLoading={saleQuery.isLoading} isError={saleQuery.isError} error={saleQuery.error}>
      {saleQuery.data && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)} className="mb-1 text-xs text-slate-500 underline">
                {t("sales.detail.back")}
              </button>
              <h1 className="text-2xl font-bold text-slate-900">
                {t("sales.detail.orderTitle", { id: saleQuery.data.orderNumber ?? saleQuery.data.id.slice(0, 8) })}
              </h1>
              <p className="text-sm text-slate-500">
                {new Date(saleQuery.data.createdAt).toLocaleString()} · {saleQuery.data.branch?.name ?? "—"} ·{" "}
                {saleQuery.data.source}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {t(`sales.statuses.${saleQuery.data.status}`)}
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("sales.detail.itemColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("sales.detail.qtyColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("sales.detail.unitPriceColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("sales.detail.discountColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("sales.detail.taxColumn")}</th>
                  <th className="px-4 py-2 font-medium">{t("sales.detail.lineTotalColumn")}</th>
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

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t("sales.detail.customerTitle")}</h2>
              {saleQuery.data.customer ? (
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-900">{saleQuery.data.customer.fullName}</span>
                  {saleQuery.data.customer.phone && (
                    <span className="text-slate-600">{saleQuery.data.customer.phone}</span>
                  )}
                  {saleQuery.data.customer.email && (
                    <span className="text-slate-600">{saleQuery.data.customer.email}</span>
                  )}
                </div>
              ) : (
                <span className="text-slate-500">{t("sales.detail.walkInCustomer")}</span>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t("sales.detail.salespersonTitle")}</h2>
              {saleQuery.data.soldByEmployee ? (
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-slate-900">{saleQuery.data.soldByEmployee.fullName}</span>
                  <span className="text-slate-600">{saleQuery.data.soldByEmployee.employeeCode}</span>
                </div>
              ) : (
                <span className="text-slate-500">{t("sales.detail.noSalesperson")}</span>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t("sales.detail.paymentsTitle")}</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {saleQuery.data.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span>{p.paymentMethod?.name ?? p.paymentMethodId}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_CLASSES[p.status] ?? "bg-slate-100 text-slate-600"}`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{currency(p.amount)}</span>
                      {p.status === "PENDING" && canConfirmPayment && (
                        <Button
                          variant="secondary"
                          isLoading={confirmPaymentMutation.isPending && confirmPaymentMutation.variables === p.id}
                          onClick={() => confirmPaymentMutation.mutate(p.id)}
                        >
                          {t("sales.detail.markAsPaid")}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t("sales.detail.totalsTitle")}</h2>
              <div className="flex justify-between py-1">
                <span>{t("sales.detail.subtotalLabel")}</span>
                <span>{currency(saleQuery.data.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>{t("sales.detail.discountLabel")}</span>
                <span>-{currency(saleQuery.data.discountTotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>{t("sales.detail.taxLabel")}</span>
                <span>{currency(saleQuery.data.taxTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 py-1 font-semibold">
                <span>{t("sales.detail.totalLabel")}</span>
                <span>{currency(saleQuery.data.total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{t("sales.detail.whatsappTitle")}</h2>
              {canManageWhatsApp && (
                <Button
                  variant="secondary"
                  isLoading={resendMutation.isPending}
                  onClick={() => resendMutation.mutate()}
                >
                  {t("sales.detail.whatsappResend")}
                </Button>
              )}
            </div>
            <DataState
              isLoading={whatsappLogsQuery.isLoading}
              isError={whatsappLogsQuery.isError}
              error={whatsappLogsQuery.error}
            >
              <div className="flex flex-col gap-2 text-sm">
                {latestWhatsAppLog ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${WHATSAPP_STATUS_CLASSES[latestWhatsAppLog.status] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {latestWhatsAppLog.status}
                    </span>
                    <span className="text-slate-500">{new Date(latestWhatsAppLog.createdAt).toLocaleString()}</span>
                    {latestWhatsAppLog.customerPhone && (
                      <span className="text-slate-500" dir="ltr">
                        {latestWhatsAppLog.customerPhone}
                      </span>
                    )}
                    {latestWhatsAppLog.errorMessage && (
                      <span className="text-red-600">{latestWhatsAppLog.errorMessage}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-slate-500">{t("sales.detail.whatsappNoAttempt")}</span>
                )}
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className="text-slate-900 underline">
                  {t("sales.detail.whatsappViewInvoice")}
                </a>
              </div>
            </DataState>
          </div>

          {canVoid && saleQuery.data.status === "COMPLETED" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-red-800">{t("sales.detail.voidSectionTitle")}</h2>
              <div className="flex gap-3">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("sales.detail.voidReasonPlaceholder")}
                  className="flex-1 rounded-md border border-red-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300"
                />
                <Button variant="danger" isLoading={voidMutation.isPending} onClick={() => voidMutation.mutate()}>
                  {t("sales.detail.voidButton")}
                </Button>
              </div>
              {voidMutation.isError && (
                <p className="mt-2 text-xs text-red-700">{t("sales.detail.voidInlineError")}</p>
              )}
            </div>
          )}
        </div>
      )}
    </DataState>
  );
}
