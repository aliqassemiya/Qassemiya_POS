import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { InventoryBulkAdjustRow } from "@qassemiya/shared-types";
import { StockMovementType, stockAdjustSchema, type StockAdjustInput } from "@qassemiya/shared-types";
import { listBranches } from "@/api/branches";
import { adjustStock, bulkAdjustInventory, listInventory, listMovements, transferStock } from "@/api/inventory";
import { getVariantByBarcode } from "@/api/products";
import type { Inventory, ProductVariant } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { useAuthStore } from "@/store/authStore";
import { useHasPermission } from "@/hooks/useHasPermission";
import { parseCsv } from "@/lib/csv";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Pagination } from "@/components/ui/Pagination";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

const PAGE_SIZE = 50;

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
  const { t } = useTranslation();
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
    onError: (err) => toast.error(getErrorMessage(err, t("inventory.variantNotFoundBarcode"))),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <SelectField label={t("common.branch")} error={errors.branchId} {...register("branchId")}>
        <option value="">{t("inventory.selectBranchPlaceholder")}</option>
        {branchesQuery.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </SelectField>

      {!defaultVariant && (
        <div className="flex items-end gap-2">
          <TextField
            label={t("inventory.scanBarcodeLabel")}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={() => barcode && lookupMutation.mutate(barcode)}>
            {t("inventory.lookupButton")}
          </Button>
        </div>
      )}
      {lookupMutation.isError && <p className="text-xs text-red-600">{t("inventory.variantNotFoundBarcode")}</p>}
      {resolvedVariant && (
        <p className="text-sm text-slate-600">
          {t("inventory.selectedLabel")} <span className="font-medium">{resolvedVariant.sku}</span>
          {resolvedVariant.productName ? ` — ${resolvedVariant.productName}` : ""}
        </p>
      )}
      {errors.productVariantId && <p className="text-xs text-red-600">{errors.productVariantId.message}</p>}

      <SelectField label={t("inventory.movementTypeLabel")} error={errors.type} {...register("type")}>
        {ADJUSTABLE_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`inventory.movementTypes.${type}`)}
          </option>
        ))}
      </SelectField>

      <TextField
        label={t("inventory.quantityChangeLabel")}
        type="number"
        error={errors.quantityChange}
        {...register("quantityChange", { valueAsNumber: true })}
      />

      <TextField label={t("common.note")} error={errors.note} {...register("note")} />

      <Button type="submit" isLoading={isPending} disabled={!resolvedVariant && !defaultVariant}>
        {t("inventory.applyAdjustmentButton")}
      </Button>
    </form>
  );
}

interface TransferLine {
  productVariantId: string;
  sku: string;
  productName: string;
  quantity: number;
}

function TransferStockForm({
  branches,
  defaultFromBranchId,
  onSubmit,
  isPending,
}: {
  branches: { id: string; name: string; isWarehouse: boolean }[];
  defaultFromBranchId?: string;
  onSubmit: (input: { fromBranchId: string; toBranchId: string; note?: string; lines: TransferLine[] }) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [fromBranchId, setFromBranchId] = useState(defaultFromBranchId ?? branches.find((b) => b.isWarehouse)?.id ?? "");
  const [toBranchId, setToBranchId] = useState("");
  const [note, setNote] = useState("");
  const [barcode, setBarcode] = useState("");
  const [lines, setLines] = useState<TransferLine[]>([]);

  const lookupMutation = useMutation({
    mutationFn: getVariantByBarcode,
    onSuccess: (variant) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.productVariantId === variant.id);
        if (existing) {
          return prev.map((l) => (l.productVariantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l));
        }
        return [
          ...prev,
          {
            productVariantId: variant.id,
            sku: variant.sku,
            productName: variant.product?.name ?? variant.sku,
            quantity: 1,
          },
        ];
      });
      setBarcode("");
    },
    onError: (err) => toast.error(getErrorMessage(err, t("inventory.variantNotFoundBarcodeSku"))),
  });

  function updateQuantity(productVariantId: string, quantity: number) {
    setLines((prev) => prev.map((l) => (l.productVariantId === productVariantId ? { ...l, quantity } : l)));
  }

  function removeLine(productVariantId: string) {
    setLines((prev) => prev.filter((l) => l.productVariantId !== productVariantId));
  }

  const canSubmit = fromBranchId && toBranchId && fromBranchId !== toBranchId && lines.length > 0 && lines.every((l) => l.quantity > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t("inventory.fromBranchLabel")} value={fromBranchId} onChange={(e) => setFromBranchId(e.target.value)}>
          <option value="">{t("inventory.selectPlaceholder")}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} {b.isWarehouse ? t("inventory.warehouseSuffix") : ""}
            </option>
          ))}
        </SelectField>
        <SelectField label={t("inventory.toBranchLabel")} value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
          <option value="">{t("inventory.selectPlaceholder")}</option>
          {branches
            .filter((b) => b.id !== fromBranchId)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </SelectField>
      </div>

      <div className="flex items-end gap-2">
        <TextField
          label={t("inventory.scanBarcodeLabel")}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && barcode.trim()) {
              e.preventDefault();
              lookupMutation.mutate(barcode.trim());
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          isLoading={lookupMutation.isPending}
          onClick={() => barcode.trim() && lookupMutation.mutate(barcode.trim())}
        >
          {t("inventory.addItemButton")}
        </Button>
      </div>

      {lines.length > 0 && (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-2 py-1 font-medium">{t("inventory.itemColumn")}</th>
              <th className="px-2 py-1 font-medium">{t("inventory.qtyColumn")}</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.productVariantId}>
                <td className="px-2 py-1">
                  {l.productName} — {l.sku}
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => updateQuantity(l.productVariantId, Number(e.target.value))}
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                  />
                </td>
                <td className="px-2 py-1 text-right">
                  <button type="button" className="text-xs text-red-600" onClick={() => removeLine(l.productVariantId)}>
                    {t("inventory.removeButton")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <TextField label={t("inventory.noteOptionalLabel")} value={note} onChange={(e) => setNote(e.target.value)} />

      <Button
        type="button"
        isLoading={isPending}
        disabled={!canSubmit}
        onClick={() => onSubmit({ fromBranchId, toBranchId, note: note || undefined, lines })}
      >
        {t("inventory.sendTransferButton")}
      </Button>
    </div>
  );
}

function numberOrZero(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function InventoryPage() {
  const { t } = useTranslation();
  const canAdjust = useHasPermission("inventory.adjust");
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const queryClient = useQueryClient();

  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [branchId, setBranchId] = useState(activeBranchId ?? "");
  const [modalState, setModalState] = useState<{ open: boolean; row?: Inventory }>({ open: false });
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importResult, setImportResult] = useState<{ updated: number; errorCount: number; errors: Array<{ row: number; message: string }> } | null>(null);
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inventoryQuery = useQuery({
    queryKey: ["inventory", branchId, page],
    queryFn: () => listInventory({ branchId: branchId || undefined, page, pageSize: PAGE_SIZE }),
  });
  const inventoryRows = inventoryQuery.data?.data ?? [];
  const totalCount = inventoryQuery.data?.totalCount ?? 0;

  // "Recent movements" — a small activity preview, not a paginated browser,
  // so this intentionally only ever fetches/shows the first page.
  const movementsQuery = useQuery({
    queryKey: ["inventory", "movements", branchId],
    queryFn: () => listMovements({ branchId: branchId || undefined }),
  });

  const adjustMutation = useMutation({
    mutationFn: adjustStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setModalState({ open: false });
      toast.success(t("inventory.adjustSaved"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("inventory.adjustSaveFailed"))),
  });

  const transferMutation = useMutation({
    mutationFn: transferStock,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setTransferOpen(false);
      toast.success(t("inventory.transferCompleted"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("inventory.transferFailed"))),
  });

  const importMutation = useMutation({
    mutationFn: bulkAdjustInventory,
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      if (result.errorCount > 0) {
        toast.error(t("inventory.importToastError", { count: result.errorCount }));
      } else {
        toast.success(t("inventory.importToastSuccess", { count: result.updated }));
      }
    },
    onError: (err) => toast.error(getErrorMessage(err, t("inventory.importFailed"))),
  });

  const allSelected = inventoryRows.length > 0 && selectedIds.size === inventoryRows.length;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(inventoryRows.map((r) => r.id)));
    }
  }

  function toExportRow(r: Inventory) {
    return {
      branchId: r.branchId,
      branch: r.branch?.name ?? "",
      productVariantId: r.productVariantId,
      sku: r.variant?.sku ?? "",
      productName: r.variant?.product?.name ?? "",
      size: r.variant?.size ?? "",
      color: r.variant?.color ?? "",
      quantityOnHand: r.quantityOnHand,
    };
  }

  const selectedExportRows = inventoryRows.filter((r) => selectedIds.has(r.id)).map(toExportRow);

  // "Export all" means every row matching the current branch filter, not
  // just the current page — fetched on demand at export time.
  async function fetchAllMatchingInventoryRows() {
    const fetchPageSize = 200;
    let fetchPage = 1;
    let all: Inventory[] = [];
    for (;;) {
      const result = await listInventory({ branchId: branchId || undefined, page: fetchPage, pageSize: fetchPageSize });
      all = all.concat(result.data);
      if (all.length >= result.totalCount || result.data.length === 0) break;
      fetchPage += 1;
    }
    return all.map(toExportRow);
  }

  const exportDate = new Date().toISOString().slice(0, 10);
  const exportHeaders = {
    branchId: t("common.branchIdColumn"),
    branch: t("common.branch"),
    productVariantId: t("products.form.variantIdColumn"),
    sku: t("inventory.skuColumn"),
    productName: t("inventory.productColumn"),
    size: t("products.form.sizeLabel"),
    color: t("products.form.colorLabel"),
    quantityOnHand: t("inventory.onHandColumn"),
  };

  async function handleImportFile(file: File) {
    setImportResult(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    const rows: InventoryBulkAdjustRow[] = parsed
      .filter((r) => r.branchId && (r.productVariantId || r.sku))
      .map((r) => ({
        branchId: r.branchId,
        productVariantId: r.productVariantId || undefined,
        sku: r.productVariantId ? undefined : r.sku || undefined,
        quantityOnHand: numberOrZero(r.quantityOnHand),
      }));
    if (rows.length > 0) importMutation.mutate(rows);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("inventory.title")}</h1>
        <div className="flex items-center gap-2">
          {canAdjust && (
            <>
              <ExportMenu
                label={t("common.exportSelected", { count: selectedIds.size })}
                disabled={selectedIds.size === 0}
                filename={`inventory-selected-${selectedExportRows.length}-${exportDate}`}
                sheetName="Inventory"
                rows={selectedExportRows}
                headers={exportHeaders}
              />
              <ExportMenu
                label={t("common.exportAll")}
                disabled={totalCount === 0}
                filename={`inventory-all-${exportDate}`}
                sheetName="Inventory"
                rows={[]}
                fetchRows={fetchAllMatchingInventoryRows}
                headers={exportHeaders}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="secondary"
                isLoading={importMutation.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {t("common.importCsv")}
              </Button>
              <Button onClick={() => setTransferOpen(true)}>{t("inventory.transferStock")}</Button>
              <Button onClick={() => setModalState({ open: true })}>{t("inventory.newAdjustment")}</Button>
            </>
          )}
        </div>
      </div>

      {importResult && (
        <div
          className={`rounded-md border p-3 text-sm ${
            importResult.errorCount > 0 ? "border-amber-300 bg-amber-50 text-amber-800" : "border-green-300 bg-green-50 text-green-800"
          }`}
        >
          <p>
            {importResult.errorCount > 0
              ? t("inventory.importUpdatedWithErrors", { count: importResult.updated, errorCount: importResult.errorCount })
              : t("inventory.importUpdatedSummary", { count: importResult.updated })}
          </p>
          {importResult.errorCount > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {importResult.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{t("inventory.importErrorRow", { row: e.row, message: e.message })}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={branchId}
          onChange={(e) => {
            setPage(1);
            setBranchId(e.target.value);
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">{t("common.allBranches")}</option>
          {branchesQuery.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={inventoryQuery.isLoading}
          isError={inventoryQuery.isError}
          error={inventoryQuery.error}
          isEmpty={inventoryRows.length === 0}
          emptyMessage={t("inventory.emptyStock")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label={t("inventory.selectAllRowsAria")}
                  />
                </th>
                <th className="px-4 py-2 font-medium">{t("inventory.productColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("inventory.skuColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("common.branch")}</th>
                <th className="px-4 py-2 font-medium">{t("inventory.onHandColumn")}</th>
                {canAdjust && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventoryRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelected(row.id)}
                      aria-label={t("inventory.selectRowAria", { value: row.variant?.sku ?? row.id })}
                    />
                  </td>
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
                  {canAdjust && (
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" onClick={() => setModalState({ open: true, row })}>
                        {t("inventory.adjustButton")}
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("inventory.recentMovementsTitle")}</h2>
        <DataState
          isLoading={movementsQuery.isLoading}
          isError={movementsQuery.isError}
          error={movementsQuery.error}
          isEmpty={(movementsQuery.data?.data.length ?? 0) === 0}
          emptyMessage={t("inventory.emptyMovements")}
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {movementsQuery.data?.data.slice(0, 15).map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span>
                  {m.variant?.sku ?? m.productVariantId} — {t(`inventory.movementTypes.${m.type}`)}
                </span>
                <span className={m.quantityChange < 0 ? "text-red-600" : "text-green-700"}>
                  {m.quantityChange > 0 ? `+${m.quantityChange}` : m.quantityChange}
                </span>
              </li>
            ))}
          </ul>
        </DataState>
      </div>

      <Modal open={modalState.open} onClose={() => setModalState({ open: false })} title={t("inventory.adjustStockModalTitle")}>
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

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title={t("inventory.transferModalTitle")}>
        <TransferStockForm
          branches={branchesQuery.data ?? []}
          isPending={transferMutation.isPending}
          onSubmit={(input) =>
            transferMutation.mutate({
              fromBranchId: input.fromBranchId,
              toBranchId: input.toBranchId,
              note: input.note,
              lines: input.lines.map((l) => ({ productVariantId: l.productVariantId, quantity: l.quantity })),
            })
          }
        />
      </Modal>
    </div>
  );
}
