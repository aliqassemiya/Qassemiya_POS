import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { VariantBulkUpdateRow } from "@qassemiya/shared-types";
import { listCategories } from "@/api/categories";
import { bulkUpdateVariants, listProducts, type BulkUpdateResult } from "@/api/products";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { useHasPermission } from "@/hooks/useHasPermission";
import { downloadCsv, parseCsv } from "@/lib/csv";

function numberOrUndefined(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function ProductsPage() {
  const canManage = useHasPermission("catalog.manage");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [importResult, setImportResult] = useState<BulkUpdateResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const productsQuery = useQuery({
    queryKey: ["products", search, categoryId],
    queryFn: () => listProducts({ search: search || undefined, categoryId: categoryId || undefined }),
  });

  function exportCsv() {
    if (!productsQuery.data?.length) return;
    const rows = productsQuery.data.flatMap((product) =>
      product.variants.map((v) => ({
        variantId: v.id,
        sku: v.sku,
        productName: product.name,
        category: product.category?.name ?? "",
        brand: product.brand ?? "",
        size: v.size ?? "",
        color: v.color ?? "",
        costPrice: v.costPrice,
        sellingPrice: v.sellingPrice,
        compareAtPrice: v.compareAtPrice ?? "",
        taxRate: v.taxRate,
        reorderPoint: v.reorderPoint ?? "",
      })),
    );
    downloadCsv(`products-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  const importMutation = useMutation({
    mutationFn: bulkUpdateVariants,
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
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
      reorderPoint: numberOrUndefined(r.reorderPoint),
    }));
    if (rows.length > 0) importMutation.mutate(rows);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button type="button" variant="secondary" onClick={exportCsv} disabled={!productsQuery.data?.length}>
                Export CSV
              </Button>
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
                Import CSV
              </Button>
            </>
          )}
          {canManage && (
            <Link
              to="/products/new"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              New product
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
            Updated {importResult.updated} variant{importResult.updated === 1 ? "" : "s"}
            {importResult.errorCount > 0 ? `, ${importResult.errorCount} row(s) failed:` : "."}
          </p>
          {importResult.errorCount > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {importResult.errors.slice(0, 10).map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {importMutation.isError && (
        <p className="text-sm text-red-600">Import failed — check the file and try again.</p>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU…"
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All categories</option>
          {categoriesQuery.data?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <DataState
          isLoading={productsQuery.isLoading}
          isError={productsQuery.isError}
          error={productsQuery.error}
          isEmpty={(productsQuery.data?.length ?? 0) === 0}
          emptyMessage="No products match your filters."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2" />
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Brand</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Variants</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {productsQuery.data?.map((product) => (
                <tr key={product.id}>
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
                  <td className="px-4 py-2 text-slate-600">{product.category?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-slate-600">{product.variants.length}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/products/${product.id}`} className="text-sm font-medium text-slate-900 underline">
                      {canManage ? "Edit" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  );
}
