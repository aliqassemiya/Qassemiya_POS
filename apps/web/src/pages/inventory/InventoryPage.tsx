import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StockMovementType, stockAdjustSchema, type StockAdjustInput } from "@qassemiya/shared-types";
import { listBranches } from "@/api/branches";
import { adjustStock, listInventory, listMovements } from "@/api/inventory";
import { getVariantByBarcode } from "@/api/products";
import type { Inventory, ProductVariant } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useAuthStore } from "@/store/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";

const ADJUSTABLE_TYPES: StockMovementType[] = [
  StockMovementType.ADJUSTMENT,
  StockMovementType.INITIAL_STOCK,
  StockMovementType.PURCHASE_RECEIVE,
  StockMovementType.TRANSFER_IN,
  StockMovementType.TRANSFER_OUT,
];

function StockAdjustForm({
  defaultBranchId,
  defaultVariant,
  onSubmit,
  isPending,
}: {
  defaultBranchId?: string;
  defaultVariant?: Pick<ProductVariant, "id" | "sku"> & { productName?: string };
  onSubmit: (input: StockAdjustInput) => void;
  isPending: boolean;
}) {
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [barcode, setBarcode] = useState("");
  const [resolvedVariant, setResolvedVariant] = useState(defaultVariant ?? null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<StockAdjustInput>({
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: {
      branchId: defaultBranchId ?? "",
      productVariantId: defaultVariant?.id ?? "",
      quantityChange: 0,
      type: StockMovementType.ADJUSTMENT,
    },
  });

  const lookupMutation = useMutation({
    mutationFn: getVariantByBarcode,
    onSuccess: (variant) => {
      setResolvedVariant(variant);
      setValue("productVariantId", variant.id, { shouldValidate: true });
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <SelectField label="Branch" error={errors.branchId} {...register("branchId")}>
        <option value="">Select a branch…</option>
        {branchesQuery.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectField>

      {!defaultVariant && (
        <div className="flex items-end gap-2">
          <TextField
            label="Scan or enter barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={() => barcode && lookupMutation.mutate(barcode)}>
            Lookup
          </Button>
        </div>
      )}
      {lookupMutation.isError && <p className="text-xs text-red-600">Variant not found for that barcode.</p>}
      {resolvedVariant && (
        <p className="text-sm text-slate-600">
          Selected: <span className="font-medium">{resolvedVariant.sku}</span>
          {resolvedVariant.productName ? ` — ${resolvedVariant.productName}` : ""}
        </p>
      )}
      {errors.productVariantId && <p className="text-xs text-red-600">{errors.productVariantId.message}</p>}

      <SelectField label="Movement type" error={errors.type} {...register("type")}>
        {ADJUSTABLE_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </SelectField>

      <TextField
        label="Quantity change (use negative to subtract)"
        type="number"
        error={errors.quantityChange}
        {...register("quantityChange", { valueAsNumber: true })}
      />

      <TextField label="Note" error={errors.note} {...register("note")} />

      <Button type="submit" isLoading={isPending} disabled={!resolvedVariant && !defaultVariant}>
        Apply adjustment
      </Button>
    </form>
  );
}

export function InventoryPage() {
  const canAdjust = useHasPermission("inventory.adjust");
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const queryClient = useQueryClient();

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [branchId, setBranchId] = useState(activeBranchId ?? "");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modalState, setModalState] = useState<{ open: boolean; row?: Inventory }>({ open: false });

  const inventoryQuery = useQuery({
    queryKey: ["inventory", branchId, lowStockOnly],
    queryFn: () => listInventory({ branchId: branchId || undefined, lowStock: lowStockOnly || undefined }),
  });

  const movementsQuery = useQuery({
    queryKey: ["inventory", "movements", branchId],
    queryFn: () => listMovements({ branchId: branchId || undefined }),
  });

  const adjustMutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setModalState({ open: false });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
        {canAdjust && <Button onClick={() => setModalState({ open: true })}>New adjustment</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={inventoryQuery.isLoading}
          isError={inventoryQuery.isError}
          error={inventoryQuery.error}
          isEmpty={(inventoryQuery.data?.length ?? 0) === 0}
          emptyMessage="No stock records match your filters."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Branch</th>
                <th className="px-4 py-2 font-medium">On hand</th>
                <th className="px-4 py-2 font-medium">Reorder point</th>
                {canAdjust && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventoryQuery.data?.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2 font-medium text-slate-900">
                    {row.variant?.product?.name ?? "—"} {row.variant?.size ?? ""} {row.variant?.color ?? ""}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.variant?.sku ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{row.branch?.name ?? "—"}</td>
                  <td
                    className={`px-4 py-2 font-medium ${row.quantityOnHand < 0 ? "text-red-600" : "text-slate-900"}`}
                  >
                    {row.quantityOnHand}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.variant?.reorderPoint ?? "—"}</td>
                  {canAdjust && (
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" onClick={() => setModalState({ open: true, row })}>
                        Adjust
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent movements</h2>
        <DataState
          isLoading={movementsQuery.isLoading}
          isError={movementsQuery.isError}
          error={movementsQuery.error}
          isEmpty={(movementsQuery.data?.length ?? 0) === 0}
          emptyMessage="No stock movements recorded yet."
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {movementsQuery.data?.slice(0, 15).map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span>
                  {m.variant?.sku ?? m.productVariantId} — {m.type}
                </span>
                <span className={m.quantityChange < 0 ? "text-red-600" : "text-green-700"}>
                  {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                </span>
              </li>
            ))}
          </ul>
        </DataState>
      </div>

      <Modal open={modalState.open} onClose={() => setModalState({ open: false })} title="Adjust stock">
        <StockAdjustForm
          defaultBranchId={modalState.row?.branchId ?? branchId}
          defaultVariant={
            modalState.row?.variant
              ? {
                  id: modalState.row.variant.id,
                  sku: modalState.row.variant.sku,
                  productName: modalState.row.variant.product?.name,
                }
              : undefined
          }
          isPending={adjustMutation.isPending}
          onSubmit={(input) => adjustMutation.mutate(input)}
        />
      </Modal>
    </div>
  );
}
