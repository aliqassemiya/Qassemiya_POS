import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getShopifyIntegration,
  listShopifySyncLogs,
  runShopifySync,
  testShopifyConnection,
  upsertShopifyIntegration,
} from "@/api/shopify";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

const LOG_STATUS_CLASSES: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
};

export function ShopifySettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const integrationQuery = useQuery({ queryKey: ["shopify", "integration"], queryFn: getShopifyIntegration });
  const logsQuery = useQuery({ queryKey: ["shopify", "sync-logs"], queryFn: listShopifySyncLogs });

  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (integrationQuery.data) {
      setShopDomain(integrationQuery.data.shopDomain);
      setIsActive(integrationQuery.data.isActive);
    }
  }, [integrationQuery.data]);

  const testMutation = useMutation({
    mutationFn: () => testShopifyConnection({ shopDomain, accessToken }),
    onSuccess: (shop) => toast.success(t("shopify.testConnectionSuccess", { name: shop.name })),
    onError: (err) => toast.error(getErrorMessage(err, t("shopify.testConnectionFailed"))),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertShopifyIntegration({ shopDomain, accessToken: accessToken || undefined, isActive }),
    onSuccess: () => {
      setAccessToken("");
      queryClient.invalidateQueries({ queryKey: ["shopify", "integration"] });
      toast.success(t("shopify.saved"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("shopify.saveFailed"))),
  });

  const syncMutation = useMutation({
    mutationFn: runShopifySync,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["shopify", "integration"] });
      queryClient.invalidateQueries({ queryKey: ["shopify", "sync-logs"] });
      if (result.skipped) {
        toast.error(t("shopify.syncSkipped", { reason: result.reason ?? "" }));
      } else {
        toast.success(t("shopify.syncStarted", { count: result.ordersUpserted ?? 0 }));
      }
    },
    onError: (err) => toast.error(getErrorMessage(err, t("shopify.syncFailed"))),
  });

  const isConnected = !!integrationQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("shopify.title")}</h1>

      <DataState isLoading={integrationQuery.isLoading} isError={integrationQuery.isError} error={integrationQuery.error}>
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("shopify.connectionTitle")}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="flex flex-col gap-4"
            >
              <TextField
                label={t("shopify.shopDomainLabel")}
                placeholder="qassemiya.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
              />
              <TextField
                label={t("shopify.accessTokenLabel")}
                type="password"
                placeholder={isConnected ? t("shopify.accessTokenPlaceholderKeep") : t("shopify.accessTokenPlaceholderNew")}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                {t("shopify.activeLabel")}
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={testMutation.isPending}
                  disabled={!shopDomain || !accessToken}
                  onClick={() => testMutation.mutate()}
                >
                  {t("shopify.testConnection")}
                </Button>
                <Button type="submit" isLoading={saveMutation.isPending} disabled={!shopDomain}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">{t("shopify.statusTitle")}</h2>
              <Button
                variant="secondary"
                isLoading={syncMutation.isPending}
                disabled={!isConnected}
                onClick={() => syncMutation.mutate()}
              >
                {t("shopify.syncNow")}
              </Button>
            </div>
            {isConnected && integrationQuery.data ? (
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-slate-500">{t("shopify.lastSyncedLabel")}</p>
                  <p className="font-medium text-slate-900">
                    {integrationQuery.data.lastSyncedAt
                      ? new Date(integrationQuery.data.lastSyncedAt).toLocaleString()
                      : t("shopify.neverSynced")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("shopify.syncFromLabel")}</p>
                  <p className="font-medium text-slate-900">
                    {new Date(integrationQuery.data.syncFromDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("common.status")}</p>
                  <p className="font-medium text-slate-900">
                    {integrationQuery.data.isActive ? t("common.active") : t("common.inactive")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("shopify.notConnected")}</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("shopify.syncLogsTitle")}</h2>
            <DataState
              isLoading={logsQuery.isLoading}
              isError={logsQuery.isError}
              error={logsQuery.error}
              isEmpty={(logsQuery.data?.length ?? 0) === 0}
              emptyMessage={t("shopify.noLogs")}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("shopify.logStartedColumn")}</th>
                    <th className="px-3 py-2 font-medium">{t("shopify.logTriggeredByColumn")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.status")}</th>
                    <th className="px-3 py-2 font-medium">{t("shopify.logOrdersColumn")}</th>
                    <th className="px-3 py-2 font-medium">{t("shopify.logErrorColumn")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logsQuery.data?.map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2 text-slate-600">{new Date(log.startedAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-600">{log.triggeredBy}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LOG_STATUS_CLASSES[log.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{log.ordersUpserted} / {log.ordersFetched}</td>
                      <td className="px-3 py-2 text-red-600">{log.errorMessage ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataState>
          </section>
        </div>
      </DataState>
    </div>
  );
}
