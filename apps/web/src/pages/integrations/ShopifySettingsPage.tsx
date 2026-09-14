import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getShopifyIntegration,
  getShopifySyncLogEntries,
  listShopifySyncLogs,
  runShopifySync,
  testShopifyConnection,
  upsertShopifyIntegration,
  type ShopifySyncLog,
} from "@/api/shopify";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

const LOG_STATUS_CLASSES: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
};

const ACTION_CLASSES: Record<string, string> = {
  CREATED: "bg-green-100 text-green-700",
  UPDATED: "bg-blue-100 text-blue-700",
};

export function ShopifySettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const integrationQuery = useQuery({ queryKey: ["shopify", "integration"], queryFn: getShopifyIntegration });
  const logsQuery = useQuery({ queryKey: ["shopify", "sync-logs"], queryFn: listShopifySyncLogs });
  const [selectedLog, setSelectedLog] = useState<ShopifySyncLog | null>(null);
  const logEntriesQuery = useQuery({
    queryKey: ["shopify", "sync-log-entries", selectedLog?.id],
    queryFn: () => getShopifySyncLogEntries(selectedLog!.id),
    enabled: !!selectedLog,
  });

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
                    <tr
                      key={log.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelectedLog(log)}
                    >
                      <td className="px-3 py-2 text-slate-600">{new Date(log.startedAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-600">{log.triggeredBy}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LOG_STATUS_CLASSES[log.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 underline decoration-dotted">
                        {log.ordersUpserted} / {log.ordersFetched}
                      </td>
                      <td className="px-3 py-2 text-red-600">{log.errorMessage ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataState>
          </section>
        </div>
      </DataState>

      <Modal
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? new Date(selectedLog.startedAt).toLocaleString() : ""}
      >
        {selectedLog && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500">{t("common.status")}</p>
                <p className="font-medium text-slate-900">{selectedLog.status}</p>
              </div>
              <div>
                <p className="text-slate-500">{t("shopify.logTriggeredByColumn")}</p>
                <p className="font-medium text-slate-900">{selectedLog.triggeredBy}</p>
              </div>
              <div>
                <p className="text-slate-500">{t("shopify.logOrdersColumn")}</p>
                <p className="font-medium text-slate-900">
                  {selectedLog.ordersUpserted} / {selectedLog.ordersFetched}
                </p>
              </div>
              {selectedLog.finishedAt && (
                <div>
                  <p className="text-slate-500">{t("shopify.logFinishedLabel")}</p>
                  <p className="font-medium text-slate-900">{new Date(selectedLog.finishedAt).toLocaleString()}</p>
                </div>
              )}
              {selectedLog.errorMessage && (
                <div className="col-span-2">
                  <p className="text-slate-500">{t("shopify.logErrorColumn")}</p>
                  <p className="font-medium text-red-600">{selectedLog.errorMessage}</p>
                </div>
              )}
            </div>

            <DataState
              isLoading={logEntriesQuery.isLoading}
              isError={logEntriesQuery.isError}
              error={logEntriesQuery.error}
              isEmpty={(logEntriesQuery.data?.length ?? 0) === 0}
              emptyMessage={t("shopify.noLogEntries")}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1 font-medium">{t("shopify.orderNumberColumn")}</th>
                    <th className="px-2 py-1 font-medium">{t("shopify.logActionColumn")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logEntriesQuery.data?.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-2 py-1 font-medium text-slate-900">{entry.orderNumber}</td>
                      <td className="px-2 py-1">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_CLASSES[entry.action] ?? "bg-slate-100 text-slate-600"}`}>
                          {t(`shopify.actions.${entry.action}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataState>
          </div>
        )}
      </Modal>
    </div>
  );
}
