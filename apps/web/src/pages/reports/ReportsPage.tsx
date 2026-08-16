import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listBranches } from "@/api/branches";
import { listVendors } from "@/api/vendors";
import {
  getLowStockReport,
  getSalesSummary,
  getVendorBalancesReport,
  getVendorPerformanceReport,
} from "@/api/reports";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";
import { downloadCsv } from "@/lib/csv";

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const branchesQuery = useQuery({ queryKey: ["branches"], queryFn: listBranches });
  const [branchId, setBranchId] = useState(activeBranchId ?? "");

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [from, setFrom] = useState(isoDate(monthAgo));
  const [to, setTo] = useState(isoDate(today));

  const summaryQuery = useQuery({
    queryKey: ["reports", "sales-summary", branchId, from, to],
    queryFn: () =>
      getSalesSummary({
        branchId: branchId || undefined,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      }),
  });

  const lowStockQuery = useQuery({
    queryKey: ["reports", "low-stock", branchId],
    queryFn: () => getLowStockReport({ branchId: branchId || undefined }),
  });

  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: () => listVendors() });
  const [vendorId, setVendorId] = useState("");

  const vendorPerformanceQuery = useQuery({
    queryKey: ["reports", "vendor-performance", vendorId, branchId, from, to],
    queryFn: () =>
      getVendorPerformanceReport({
        vendorId: vendorId || undefined,
        branchId: branchId || undefined,
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      }),
  });

  const vendorBalancesQuery = useQuery({
    queryKey: ["reports", "vendor-balances", vendorId],
    queryFn: () => getVendorBalancesReport({ vendorId: vendorId || undefined }),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

      <div className="flex flex-wrap items-end gap-3">
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
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
        >
          <option value="">All vendors</option>
          {vendorsQuery.data?.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Sales summary</h2>
          <Button
            variant="secondary"
            disabled={!summaryQuery.data}
            onClick={() =>
              summaryQuery.data &&
              downloadCsv(`sales-summary-${from}-to-${to}.csv`, [
                {
                  from: summaryQuery.data.from,
                  to: summaryQuery.data.to,
                  orderCount: summaryQuery.data.orderCount,
                  subtotal: summaryQuery.data.subtotal,
                  discountTotal: summaryQuery.data.discountTotal,
                  taxTotal: summaryQuery.data.taxTotal,
                  total: summaryQuery.data.total,
                },
              ])
            }
          >
            Export CSV
          </Button>
        </div>
        <DataState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError} error={summaryQuery.error}>
          {summaryQuery.data && (
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-slate-500">Orders</p>
                <p className="text-lg font-semibold text-slate-900">{summaryQuery.data.orderCount}</p>
              </div>
              <div>
                <p className="text-slate-500">Subtotal</p>
                <p className="text-lg font-semibold text-slate-900">{currency(summaryQuery.data.subtotal)}</p>
              </div>
              <div>
                <p className="text-slate-500">Tax</p>
                <p className="text-lg font-semibold text-slate-900">{currency(summaryQuery.data.taxTotal)}</p>
              </div>
              <div>
                <p className="text-slate-500">Total</p>
                <p className="text-lg font-semibold text-slate-900">{currency(summaryQuery.data.total)}</p>
              </div>
            </div>
          )}
        </DataState>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Low stock</h2>
          <Button
            variant="secondary"
            disabled={!lowStockQuery.data?.length}
            onClick={() =>
              lowStockQuery.data &&
              downloadCsv(
                `low-stock-${isoDate(new Date())}.csv`,
                lowStockQuery.data.map((row) => ({
                  branch: row.branchName,
                  sku: row.sku,
                  product: row.productName,
                  size: row.size ?? "",
                  color: row.color ?? "",
                  quantityOnHand: row.quantityOnHand,
                  reorderPoint: row.reorderPoint,
                })),
              )
            }
          >
            Export CSV
          </Button>
        </div>
        <DataState
          isLoading={lowStockQuery.isLoading}
          isError={lowStockQuery.isError}
          error={lowStockQuery.error}
          isEmpty={(lowStockQuery.data?.length ?? 0) === 0}
          emptyMessage="Nothing is below its reorder point."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Branch</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium">On hand</th>
                <th className="px-3 py-2 font-medium">Reorder point</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lowStockQuery.data?.map((row) => (
                <tr key={`${row.branchId}-${row.productVariantId}`}>
                  <td className="px-3 py-2">{row.branchName}</td>
                  <td className="px-3 py-2">{row.productName}</td>
                  <td className="px-3 py-2">{row.sku}</td>
                  <td className="px-3 py-2 font-medium text-red-600">{row.quantityOnHand}</td>
                  <td className="px-3 py-2">{row.reorderPoint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Vendor performance</h2>
          <Button
            variant="secondary"
            disabled={!vendorPerformanceQuery.data?.byVendor.length}
            onClick={() =>
              vendorPerformanceQuery.data &&
              downloadCsv(
                `vendor-performance-${from}-to-${to}.csv`,
                vendorPerformanceQuery.data.byVendor.map((row) => ({
                  vendor: row.vendorName,
                  unitsSold: row.unitsSold,
                  revenue: row.revenue,
                  cost: row.cost,
                  profit: row.profit,
                })),
              )
            }
          >
            Export CSV
          </Button>
        </div>
        <DataState
          isLoading={vendorPerformanceQuery.isLoading}
          isError={vendorPerformanceQuery.isError}
          error={vendorPerformanceQuery.error}
          isEmpty={(vendorPerformanceQuery.data?.byVendor.length ?? 0) === 0}
          emptyMessage="No sales data for tagged products in this period yet."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Units sold</th>
                <th className="px-3 py-2 font-medium">Revenue</th>
                <th className="px-3 py-2 font-medium">Cost</th>
                <th className="px-3 py-2 font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorPerformanceQuery.data?.byVendor.map((row) => (
                <tr key={row.vendorId}>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.vendorName}</td>
                  <td className="px-3 py-2">{row.unitsSold}</td>
                  <td className="px-3 py-2">{currency(row.revenue)}</td>
                  <td className="px-3 py-2">{currency(row.cost)}</td>
                  <td className="px-3 py-2 font-medium text-green-700">{currency(row.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Vendor balances</h2>
          <Button
            variant="secondary"
            disabled={!vendorBalancesQuery.data?.length}
            onClick={() =>
              vendorBalancesQuery.data &&
              downloadCsv(
                `vendor-balances-${isoDate(new Date())}.csv`,
                vendorBalancesQuery.data.map((row) => ({
                  vendor: row.vendorName,
                  totalInvoiced: row.totalInvoiced,
                  totalPaid: row.totalPaid,
                  totalReturnCredits: row.totalReturnCredits,
                  outstanding: row.outstanding,
                })),
              )
            }
          >
            Export CSV
          </Button>
        </div>
        <DataState
          isLoading={vendorBalancesQuery.isLoading}
          isError={vendorBalancesQuery.isError}
          error={vendorBalancesQuery.error}
          isEmpty={(vendorBalancesQuery.data?.length ?? 0) === 0}
          emptyMessage="No vendor invoices recorded yet."
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Invoiced</th>
                <th className="px-3 py-2 font-medium">Paid</th>
                <th className="px-3 py-2 font-medium">Return credits</th>
                <th className="px-3 py-2 font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendorBalancesQuery.data?.map((row) => (
                <tr key={row.vendorId}>
                  <td className="px-3 py-2 font-medium text-slate-900">{row.vendorName}</td>
                  <td className="px-3 py-2">{currency(row.totalInvoiced)}</td>
                  <td className="px-3 py-2">{currency(row.totalPaid)}</td>
                  <td className="px-3 py-2">{currency(row.totalReturnCredits)}</td>
                  <td className={`px-3 py-2 font-medium ${row.outstanding > 0 ? "text-red-600" : "text-slate-900"}`}>
                    {currency(row.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </section>
    </div>
  );
}
