import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { listVendors } from "@/api/vendors";
import { listPurchaseOrders } from "@/api/purchase-orders";
import {
  createPurchaseInvoice,
  listPurchaseInvoices,
  type CreatePurchaseInvoiceInput,
} from "@/api/purchase-invoices";
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

// No shared-types schema exists for PurchaseInvoice yet — see the note atop
// api/purchase-invoices.ts.
function buildPurchaseInvoiceSchema(t: (key: string) => string) {
  return z.object({
    vendorId: z.string().min(1, t("purchaseInvoices.vendorRequired")),
    purchaseOrderId: z.string().optional(),
    invoiceNumber: z.string().min(1, t("purchaseInvoices.invoiceNumberRequired")),
    invoiceDate: z.string().min(1, t("purchaseInvoices.invoiceDateRequired")),
    dueDate: z.string().optional(),
    subtotal: z.coerce.number().nonnegative(),
    taxTotal: z.coerce.number().nonnegative(),
    total: z.coerce.number().nonnegative(),
    notes: z.string().optional(),
  });
}

function NewInvoiceForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation();
  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listVendors() });
  const purchaseOrdersQuery = useQuery({
    queryKey: ["purchase-orders", "for-invoice"],
    queryFn: () => listPurchaseOrders(),
  });

  const purchaseInvoiceSchema = useMemo(() => buildPurchaseInvoiceSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePurchaseInvoiceInput>({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: { subtotal: 0, taxTotal: 0, total: 0 },
  });

  const createMutation = useMutation({
    mutationFn: createPurchaseInvoice,
    onSuccess: () => {
      onCreated();
      toast.success(t("purchaseInvoices.created"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseInvoices.createFailed"))),
  });

  // The API's invoiceDate/dueDate are ISO datetime strings (z.string().datetime()),
  // but the <input type="date"> fields below produce plain "YYYY-MM-DD" —
  // convert on submit, same as ReportsPage's date-range params do.
  const onSubmit = (input: CreatePurchaseInvoiceInput) =>
    createMutation.mutate({
      ...input,
      invoiceDate: new Date(input.invoiceDate).toISOString(),
      dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : undefined,
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <SelectField label={t("purchaseInvoices.vendorLabel")} error={errors.vendorId} {...register("vendorId")}>
        <option value="">{t("purchaseInvoices.selectVendorPlaceholder")}</option>
        {vendorsQuery.data?.map((v) => (
          <option key={v.id} value={v.id}>
            {v.code} — {v.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t("purchaseInvoices.purchaseOrderOptionalLabel")}
        error={errors.purchaseOrderId}
        {...register("purchaseOrderId")}
      >
        <option value="">{t("purchaseInvoices.noneOption")}</option>
        {purchaseOrdersQuery.data?.map((po) => (
          <option key={po.id} value={po.id}>
            PO #{po.id.slice(0, 8)} — {po.vendor?.name ?? po.vendorId}
          </option>
        ))}
      </SelectField>
      <TextField label={t("purchaseInvoices.invoiceNumberLabel")} error={errors.invoiceNumber} {...register("invoiceNumber")} />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={t("purchaseInvoices.invoiceDateLabel")}
          type="date"
          error={errors.invoiceDate}
          {...register("invoiceDate")}
        />
        <TextField label={t("purchaseInvoices.dueDateLabel")} type="date" error={errors.dueDate} {...register("dueDate")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <TextField
          label={t("purchaseInvoices.subtotalLabel")}
          type="number"
          step="0.01"
          error={errors.subtotal}
          {...register("subtotal", { valueAsNumber: true })}
        />
        <TextField
          label={t("purchaseInvoices.taxTotalLabel")}
          type="number"
          step="0.01"
          error={errors.taxTotal}
          {...register("taxTotal", { valueAsNumber: true })}
        />
        <TextField
          label={t("purchaseInvoices.totalLabel")}
          type="number"
          step="0.01"
          error={errors.total}
          {...register("total", { valueAsNumber: true })}
        />
      </div>
      <TextField label={t("purchaseInvoices.notesLabel")} error={errors.notes} {...register("notes")} />
      <Button type="submit" isLoading={createMutation.isPending}>
        {t("purchaseInvoices.createInvoiceButton")}
      </Button>
      {createMutation.isError && (
        <p className="text-xs text-red-600">{t("purchaseInvoices.createInlineError")}</p>
      )}
    </form>
  );
}

export function PurchaseInvoicesPage() {
  const { t } = useTranslation();
  const canManage = useHasPermission("purchases.invoice.manage");
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState("");

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listVendors() });
  const invoicesQuery = useQuery({
    queryKey: ["purchase-invoices", vendorId, status],
    queryFn: () =>
      listPurchaseInvoices({
        vendorId: vendorId || undefined,
        status: (status || undefined) as (typeof PurchaseInvoiceStatus)[keyof typeof PurchaseInvoiceStatus] | undefined,
      }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("purchaseInvoices.title")}</h1>
        {canManage && <Button onClick={() => setModalOpen(true)}>{t("purchaseInvoices.newInvoice")}</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("purchaseInvoices.allVendors")}</option>
          {vendorsQuery.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("purchaseInvoices.allStatuses")}</option>
          {Object.values(PurchaseInvoiceStatus).map((s) => (
            <option key={s} value={s}>
              {t(`purchaseInvoices.statuses.${s}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={invoicesQuery.isLoading}
          isError={invoicesQuery.isError}
          error={invoicesQuery.error}
          isEmpty={(invoicesQuery.data?.length ?? 0) === 0}
          emptyMessage={t("purchaseInvoices.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("purchaseInvoices.invoiceNumberColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseInvoices.vendorColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseInvoices.dateColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("purchaseInvoices.totalColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.status")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoicesQuery.data?.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{inv.vendor?.name ?? inv.vendorId}</td>
                  <td className="px-4 py-2 text-slate-600">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{currency(inv.total)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_CLASSES[inv.status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {t(`purchaseInvoices.statuses.${inv.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/purchase-invoices/${inv.id}`} className="text-sm font-medium text-slate-900 underline">
                      {t("common.view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("purchaseInvoices.newInvoiceModalTitle")}>
        <NewInvoiceForm
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
            setModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
