import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { VariantBulkUpdateRow } from "@qassemiya/shared-types";
import { bulkUpdateVariants, listProducts, type BulkUpdateResult } from "@/api/products";
import type { Product } from "@/types/entities";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { ExportMenu } from "@/components/ui/ExportMenu";
import { Pagination } from "@/components/ui/Pagination";
import { useHasPermission } from "@/hooks/useHasPermission";
import { parseCsv } from "@/lib/csv";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

const PAGE_SIZE = 50;

function numberOrUndefined(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function productToExportRows(product: Product) {
  return product.variants.map((v) => ({
    variantId: v.id,
    sku: v.sku,
    productName: product.name,
    brand: product.brand ?? "",
    size: v.size ?? "",
    color: v.color ?? "",
    costPrice: v.costPrice,
    sellingPrice: v.sellingPrice,
    compareAtPrice: v.compareAtPrice ?? "",
    taxRate: v.taxRate,
  }));
}

export function ProductsPage() {
  const { t } = useTranslation();
  const canManage = useHasPermission("catalog.manage");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [importResult, setImportResult] = useState<BulkUpdateResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const productsQuery = useQuery({
    queryKey: ["products", search, page],
    queryFn: () => listProducts({ search: search || undefined, page, pageSize: PAGE_SIZE }),
  });

  const products = productsQuery.data?.data ?? [];
  const totalCount = productsQuery.data?.totalCount ?? 0;

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1);
      setter(v);
    };
  }

  const allSelected = products.length > 0 && selectedIds.size === products.length;

  function toggleSelected(productId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  const selectedExportRows = products.filter((p) => selectedIds.has(p.id)).flatMap(productToExportRows);

  // "Export all" means every product matching the current filters, not just
  // the current page — fetched on demand at export time (not via
  // productsQuery, which is intentionally scoped to one page for the table).
  async function fetchAllMatchingProductRows() {
    const fetchPageSize = 100;
    let fetchPage = 1;
    let all: Product[] = [];
    for (;;) {
      const result = await listProducts({
        search: search || undefined,
        page: fetchPage,
        pageSize: fetchPageSize,
      });
      all = all.concat(result.data);
      if (all.length >= result.totalCount || result.data.length === 0) break;
      fetchPage += 1;
    }
    return all.flatMap(productToExportRows);
  }

  const exportDate = new Date().toISOString().slice(0, 10);
  const exportHeaders = {
    variantId: t("products.form.variantIdColumn"),
    sku: t("products.form.skuLabel"),
    productName: t("common.name"),
    brand: t("products.form.brandLabel"),
    size: t("products.form.sizeLabel"),
    color: t("products.form.colorLabel"),
    costPrice: t("products.form.costPriceLabel"),
    sellingPrice: t("products.form.sellingPriceLabel"),
    compareAtPrice: t("products.form.compareAtPriceLabel"),
    taxRate: t("products.form.taxRateLabel"),
  };

  const importMutation = useMutation({
    mutationFn: bulkUpdateVariants,
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (result.errorCount > 0) {
        toast.error(t("products.importToastError", { count: result.errorCount }));
      } else {
        toast.success(t("products.importToastSuccess", { count: result.updated }));
      }
    },
    onError: (err) => toast.error(getErrorMessage(err, t("products.importFailed"))),
  });

  async function handleImportFile(file: File) {
    setImportResult(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    const rows: VariantBulkUpdateRow[] = parsed.map((r) => ({
      variantId: r.variantId || undefined,
      sku: r.variantId ? undefined : r.sku || undefined,
      costPrice: numberOrUndefined(r.costPrice),
      sellingPrice: numberOrUndefined(r.sellingPrice),
      compareAtPrice: numberOrUndefined(r.compareAtPrice),
      taxRate: numberOrUndefined(r.taxRate),
    }));
    if (rows.length > 0) importMutation.mutate(rows);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t("products.title")}</h1>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <ExportMenu
                label={t("products.exportSelected", { count: selectedIds.size })}
                disabled={selectedIds.size === 0}
                filename={`products-selected-${selectedExportRows.length}-${exportDate}`}
                sheetName="Products"
                rows={selectedExportRows}
                headers={exportHeaders}
              />
              <ExportMenu
                label={t("products.exportAll")}
                disabled={totalCount === 0}
                filename={`products-all-${exportDate}`}
                sheetName="Products"
                rows={[]}
                fetchRows={fetchAllMatchingProductRows}
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
                {t("products.importCsv")}
              </Button>
            </>
          )}
          {canManage && (
            <Link
              to="/products/new"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              {t("products.newProduct")}
            </Link>
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
            {t("products.importUpdatedSummary", { count: importResult.updated })}
            {importResult.errorCount > 0 ? t("products.importUpdatedWithErrors", { count: importResult.errorCount }) : "."}
          </p>
          {importResult.errorCount > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {importResult.errors.slice(0, 10).map((e, i) => (
                <li key={i}>{t("products.importErrorRow", { row: e.row, message: e.message })}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {importMutation.isError && (
        <p className="text-sm text-red-600">{t("products.importFailedInline")}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => resetToFirstPage(setSearch)(e.target.value)}
          placeholder={t("products.searchPlaceholder")}
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={productsQuery.isLoading}
          isError={productsQuery.isError}
          error={productsQuery.error}
          isEmpty={products.length === 0}
          emptyMessage={t("products.empty")}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label={t("products.selectAllAria")}
                  />
                </th>
                <th className="px-4 py-2" />
                <th className="px-4 py-2 font-medium">{t("products.skuColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("products.nameColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("products.brandColumn")}</th>
                <th className="px-4 py-2 font-medium">{t("products.variantsColumn")}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelected(product.id)}
                      aria-label={t("products.selectRowAria", { name: product.name })}
                    />
                  </td>
                  <td className="px-4 py-2">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-md border border-slate-200 object-cover"
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md border border-dashed border-slate-200" />
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600">{product.variants[0]?.sku ?? "—"}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{product.name}</td>
                  <td className="px-4 py-2 text-slate-600">{product.brand ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{product.variants.length}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/products/${product.id}`} className="text-sm font-medium text-slate-900 underline">
                      {canManage ? t("common.edit") : t("common.view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
    </div>
  );
}
