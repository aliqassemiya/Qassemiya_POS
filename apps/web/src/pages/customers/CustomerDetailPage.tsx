import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCustomer } from "@/api/customers";
import { listSales } from "@/api/sales";
import { listShopifyOrders } from "@/api/shopify";
import { DataState } from "@/components/ui/DataState";
import { Pagination } from "@/components/ui/Pagination";
import { useUrlNumberState } from "@/hooks/useUrlState";

const PAGE_SIZE = 20;
const SHOPIFY_PAGE_SIZE = 20;

function currency(n: number, code = "SAR") {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: code || "SAR" }).format(n);
}

const STATUS_CLASSES: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-700",
  VOIDED: "bg-red-100 text-red-700",
  REFUNDED: "bg-amber-100 text-amber-700",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-700",
};

export function CustomerDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useUrlNumberState("page", 1);
  const [shopifyPage, setShopifyPage] = useUrlNumberState("shopifyPage", 1);

  const customerQuery = useQuery({
    queryKey: ["customers", id],
    queryFn: () => getCustomer(id as string),
    enabled: Boolean(id),
  });

  const salesQuery = useQuery({
    queryKey: ["sales", "by-customer", id, page],
    queryFn: () => listSales({ customerId: id, page, pageSize: PAGE_SIZE }),
    enabled: Boolean(id),
  });

  const shopifyOrdersQuery = useQuery({
    queryKey: ["shopify", "orders", "by-customer", id, shopifyPage],
    queryFn: () => listShopifyOrders({ customerId: id, page: shopifyPage, pageSize: SHOPIFY_PAGE_SIZE }),
    enabled: Boolean(id),
  });

  const sales = salesQuery.data?.data ?? [];
  const totalCount = salesQuery.data?.totalCount ?? 0;
  const shopifyOrders = shopifyOrdersQuery.data?.orders ?? [];
  const shopifyTotalCount = shopifyOrdersQuery.data?.totalCount ?? 0;

  return (
    <DataState isLoading={customerQuery.isLoading} isError={customerQuery.isError} error={customerQuery.error}>
      {customerQuery.data && (
        <div className="flex flex-col gap-6">
          <div>
            <button onClick={() => navigate(-1)} className="mb-1 text-xs text-slate-500 underline">
              {t("customers.detail.back")}
            </button>
            <h1 className="text-2xl font-bold text-slate-900">{customerQuery.data.fullName}</h1>
            <p className="text-sm text-slate-500">
              {customerQuery.data.phone ?? "—"}
              {customerQuery.data.email ? ` · ${customerQuery.data.email}` : ""}
            </p>
            {customerQuery.data.notes && <p className="mt-1 text-sm text-slate-500">{customerQuery.data.notes}</p>}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">{t("customers.detail.ordersTitle")}</h2>
            </div>
            <DataState
              isLoading={salesQuery.isLoading}
              isError={salesQuery.isError}
              error={salesQuery.error}
              isEmpty={sales.length === 0}
              emptyMessage={t("customers.detail.ordersEmpty")}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("sales.orderNumberColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("sales.dateColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("sales.branchColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("sales.totalColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("common.status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">
                        <Link to={`/sales/${order.orderNumber ?? order.id}`} className="hover:underline">
                          #{order.orderNumber ?? order.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{new Date(order.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2 text-slate-600">{order.branch?.name ?? "—"}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">{currency(order.total)}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_CLASSES[order.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {t(`sales.statuses.${order.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataState>
          </div>

          <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">{t("customers.detail.onlineOrdersTitle")}</h2>
            </div>
            <DataState
              isLoading={shopifyOrdersQuery.isLoading}
              isError={shopifyOrdersQuery.isError}
              error={shopifyOrdersQuery.error}
              isEmpty={shopifyOrders.length === 0}
              emptyMessage={t("customers.detail.onlineOrdersEmpty")}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("sales.orderNumberColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("sales.dateColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("sales.branchColumn")}</th>
                    <th className="px-4 py-2 font-medium">{t("sales.totalColumn")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shopifyOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-2 font-mono text-xs text-slate-600">#{order.orderNumber}</td>
                      <td className="px-4 py-2 text-slate-600">{new Date(order.shopifyCreatedAt).toLocaleString()}</td>
                      <td className="px-4 py-2 text-slate-600">{t("customers.detail.onlineShopifyBranch")}</td>
                      <td className="px-4 py-2 font-medium text-slate-900">
                        {currency(order.currentTotalPrice, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataState>
          </div>

          <Pagination
            page={shopifyPage}
            pageSize={SHOPIFY_PAGE_SIZE}
            totalCount={shopifyTotalCount}
            onPageChange={setShopifyPage}
          />
        </div>
      )}
    </DataState>
  );
}
