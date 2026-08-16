import { useQuery } from "@tanstack/react-query";
import { getLowStockReport, getSalesSummary } from "@/api/reports";
import { useAuthStore } from "@/store/authStore";
import { DataState } from "@/components/ui/DataState";

function todayRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const to = now.toISOString();
  return { from, to };
}

function currency(n: number) {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

export function DashboardPage() {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const { from, to } = todayRange();

  const summaryQuery = useQuery({
    queryKey: ["reports", "sales-summary", activeBranchId, from, to],
    queryFn: () => getSalesSummary({ branchId: activeBranchId ?? undefined, from, to }),
  });

  const lowStockQuery = useQuery({
    queryKey: ["reports", "low-stock", activeBranchId],
    queryFn: () => getLowStockReport({ branchId: activeBranchId ?? undefined }),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Today's sales</p>
          <DataState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError} error={summaryQuery.error}>
            <p className="mt-1 text-2xl font-bold text-slate-900">{currency(summaryQuery.data?.total ?? 0)}</p>
          </DataState>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Orders today</p>
          <DataState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError} error={summaryQuery.error}>
            <p className="mt-1 text-2xl font-bold text-slate-900">{summaryQuery.data?.orderCount ?? 0}</p>
          </DataState>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Tax collected</p>
          <DataState isLoading={summaryQuery.isLoading} isError={summaryQuery.isError} error={summaryQuery.error}>
            <p className="mt-1 text-2xl font-bold text-slate-900">{currency(summaryQuery.data?.taxTotal ?? 0)}</p>
          </DataState>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Low-stock variants</p>
          <DataState isLoading={lowStockQuery.isLoading} isError={lowStockQuery.isError} error={lowStockQuery.error}>
            <p className="mt-1 text-2xl font-bold text-slate-900">{lowStockQuery.data?.length ?? 0}</p>
          </DataState>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Low stock alerts</h2>
        <DataState
          isLoading={lowStockQuery.isLoading}
          isError={lowStockQuery.isError}
          error={lowStockQuery.error}
          isEmpty={(lowStockQuery.data?.length ?? 0) === 0}
          emptyMessage="Nothing is below its reorder point."
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {lowStockQuery.data?.slice(0, 10).map((row) => (
              <li key={row.productVariantId} className="flex items-center justify-between py-2">
                <span>
                  {row.productName} — {row.sku}
                </span>
                <span className="font-medium text-red-600">
                  {row.quantityOnHand} / {row.reorderPoint}
                </span>
              </li>
            ))}
          </ul>
        </DataState>
      </div>
    </div>
  );
}
