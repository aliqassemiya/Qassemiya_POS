import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { listBranches } from "@/api/branches";
import { listVendors } from "@/api/vendors";
import { getVariantByBarcode, listProducts } from "@/api/products";
import { createPurchaseOrder, type CreatePurchaseOrderInput } from "@/api/purchase-orders";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

// No shared-types schema exists for PurchaseOrder yet — see the note atop
// types/entities.ts / api/purchase-orders.ts.
function buildPurchaseOrderSchema(t: (key: string) => string) {
  const purchaseOrderItemSchema = z.object({
    productVariantId: z.string().min(1, t("purchaseOrders.form.variantRequired")),
    quantityOrdered: z.coerce.number().int().positive(t("purchaseOrders.form.quantityPositive")),
    unitCost: z.coerce.number().nonnegative(t("purchaseOrders.form.costNonNegative")),
  });

  return z.object({
    vendorId: z.string().min(1, t("purchaseOrders.form.vendorRequired")),
    branchId: z.string().min(1, t("purchaseOrders.form.branchRequired")),
    notes: z.string().optional(),
    items: z.array(purchaseOrderItemSchema).min(1, t("purchaseOrders.form.itemsMinOne")),
  });
}

interface LineItemMeta {
  sku: string;
  label: string;
}

export function PurchaseOrderFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listVendors() });
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });

  const purchaseOrderSchema = useMemo(() => buildPurchaseOrderSchema(t), [t]);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePurchaseOrderInput>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: { vendorId: "", branchId: activeBranchId ?? "", notes: "", items: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const [itemMeta, setItemMeta] = useState<LineItemMeta[]>([]);

  // Variant search — mirrors the barcode/SKU lookup pattern used by
  // InventoryPage's stock-adjust form, plus a name/SKU text search
  // (listProducts({ search })) since a PO is typically built line by line
  // rather than one barcode scan at a time.
  const [search, setSearch] = useState("");
  const searchQuery = useQuery({
    queryKey: ["products", "po-search", search],
    queryFn: () => listProducts({ search }),
    enabled: search.length > 1,
  });

  const [barcode, setBarcode] = useState("");
  const barcodeLookup = useMutation({
    mutationFn: getVariantByBarcode,
    onSuccess: (variant, barcodeArg) => {
      append({ productVariantId: variant.id, quantityOrdered: 1, unitCost: variant.costPrice, lineTotal: variant.costPrice });
      setItemMeta((prev) => [
        ...prev,
        { sku: variant.sku, label: t("purchaseOrders.form.barcodeItemLabel", { barcode: barcodeArg }) },
      ]);
      setBarcode("");
    },
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseOrders.form.variantNotFoundBarcode"))),
  });

  const addVariantRow = (variantId: string, sku: string, label: string, costPrice: number) => {
    if (fields.some((_, i) => itemMeta[i]?.sku === sku)) return;
    append({ productVariantId: variantId, quantityOrdered: 1, unitCost: costPrice, lineTotal: costPrice });
    setItemMeta((prev) => [...prev, { sku, label }]);
  };

  const removeRow = (index: number) => {
    remove(index);
    setItemMeta((prev) => prev.filter((_, i) => i !== index));
  };

  const createMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: (po) => {
      navigate(`/purchase-orders/${po.id}`);
      toast.success(t("purchaseOrders.form.created"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("purchaseOrders.form.createToastFailed"))),
  });

  // The API requires header totals (subtotal/total) and a per-item lineTotal
  // — computed here rather than collected as form fields, same convention as
  // the POS/sales cart totals (no per-item tax capture in this form yet, so
  // taxTotal is 0).
  const onSubmit = (input: CreatePurchaseOrderInput) => {
    const items = input.items.map((item) => ({
      ...item,
      lineTotal: Math.round(item.unitCost * item.quantityOrdered * 100) / 100,
    }));
    const subtotal = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
    createMutation.mutate({ ...input, items, subtotal, taxTotal: 0, discountTotal: 0, total: subtotal });
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-slate-900">{t("purchaseOrders.form.title")}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2">
          <SelectField label={t("purchaseOrders.form.vendorLabel")} error={errors.vendorId} {...register("vendorId")}>
            <option value="">{t("purchaseOrders.form.selectVendorPlaceholder")}</option>
            {vendorsQuery.data?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t("purchaseOrders.form.branchLabel")} error={errors.branchId} {...register("branchId")}>
            <option value="">{t("purchaseOrders.form.selectBranchPlaceholder")}</option>
            {branchesQuery.data?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </SelectField>
          <div className="sm:col-span-2">
            <TextField label={t("purchaseOrders.form.notesLabel")} error={errors.notes} {...register("notes")} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("purchaseOrders.form.addLineItemsTitle")}</h2>

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[16rem]">
              <TextField
                label={t("purchaseOrders.form.searchLabel")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <TextField label={t("purchaseOrders.form.scanBarcodeLabel")} value={barcode} onChange={(e) => setBarcode(e.target.value)} />
              <Button
                type="button"
                variant="secondary"
                isLoading={barcodeLookup.isPending}
                onClick={() => barcode && barcodeLookup.mutate(barcode)}
              >
                {t("purchaseOrders.form.addByBarcodeButton")}
              </Button>
            </div>
          </div>
          {barcodeLookup.isError && <p className="mb-3 text-xs text-red-600">{t("purchaseOrders.form.variantNotFoundBarcode")}</p>}

          {search.length > 1 && (
            <div className="mb-4 max-h-56 overflow-y-auto rounded-md border border-slate-100">
              <DataState
                isLoading={searchQuery.isLoading}
                isError={searchQuery.isError}
                error={searchQuery.error}
                isEmpty={(searchQuery.data?.data.length ?? 0) === 0}
                emptyMessage={t("purchaseOrders.form.noMatchingProducts")}
              >
                <table className="w-full text-left text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {searchQuery.data?.data.flatMap((product) =>
                      product.variants.map((variant) => (
                        <tr key={variant.id}>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600">{variant.sku}</td>
                          <td className="px-3 py-2 text-slate-900">
                            {product.name} {variant.size ?? ""} {variant.color ?? ""}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                addVariantRow(
                                  variant.id,
                                  variant.sku,
                                  `${product.name} ${variant.size ?? ""} ${variant.color ?? ""}`.trim(),
                                  variant.costPrice,
                                )
                              }
                            >
                              {t("purchaseOrders.form.addButton")}
                            </Button>
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </DataState>
            </div>
          )}

          {errors.items?.message && <p className="mb-3 text-xs text-red-600">{errors.items.message}</p>}

          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_repeat(2,7rem)_auto] items-end gap-3 rounded-md border border-slate-100 p-3"
              >
                <div className="text-sm">
                  <p className="font-medium text-slate-900">{itemMeta[index]?.label ?? t("purchaseOrders.form.defaultItemLabel")}</p>
                  <p className="font-mono text-xs text-slate-500">{itemMeta[index]?.sku}</p>
                </div>
                <TextField
                  label={t("purchaseOrders.form.qtyOrderedLabel")}
                  type="number"
                  error={errors.items?.[index]?.quantityOrdered}
                  {...register(`items.${index}.quantityOrdered` as const, { valueAsNumber: true })}
                />
                <TextField
                  label={t("purchaseOrders.form.unitCostLabel")}
                  type="number"
                  step="0.01"
                  error={errors.items?.[index]?.unitCost}
                  {...register(`items.${index}.unitCost` as const, { valueAsNumber: true })}
                />
                <input type="hidden" {...register(`items.${index}.productVariantId` as const)} />
                <Button type="button" variant="ghost" onClick={() => removeRow(index)}>
                  {t("purchaseOrders.form.removeButton")}
                </Button>
              </div>
            ))}
            {fields.length === 0 && (
              <p className="text-sm text-slate-500">{t("purchaseOrders.form.noLineItemsYet")}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" isLoading={isSubmitting || createMutation.isPending}>
            {t("purchaseOrders.form.createPurchaseOrderButton")}
          </Button>
        </div>
        {createMutation.isError && (
          <p className="text-xs text-red-600">{t("purchaseOrders.form.createFailed")}</p>
        )}
      </form>
    </div>
  );
}
