import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getWhatsAppIntegration,
  listWhatsAppMessageLogs,
  testWhatsAppConnection,
  upsertWhatsAppIntegration,
} from "@/api/whatsapp";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

const LOG_STATUS_CLASSES: Record<string, string> = {
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-slate-100 text-slate-600",
};

export function WhatsAppSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const integrationQuery = useQuery({ queryKey: ["whatsapp", "integration"], queryFn: getWhatsAppIntegration });
  const logsQuery = useQuery({ queryKey: ["whatsapp", "message-logs"], queryFn: () => listWhatsAppMessageLogs() });

  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("ar");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (integrationQuery.data) {
      setPhoneNumberId(integrationQuery.data.phoneNumberId);
      setWabaId(integrationQuery.data.wabaId);
      setTemplateName(integrationQuery.data.templateName);
      setTemplateLanguage(integrationQuery.data.templateLanguage);
      setIsActive(integrationQuery.data.isActive);
    }
  }, [integrationQuery.data]);

  const testMutation = useMutation({
    mutationFn: () => testWhatsAppConnection({ phoneNumberId, accessToken }),
    onSuccess: (info) => toast.success(t("whatsapp.testConnectionSuccess", { name: info.verifiedName })),
    onError: (err) => toast.error(getErrorMessage(err, t("whatsapp.testConnectionFailed"))),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      upsertWhatsAppIntegration({
        phoneNumberId,
        wabaId,
        accessToken: accessToken || undefined,
        templateName,
        templateLanguage,
        isActive,
      }),
    onSuccess: () => {
      setAccessToken("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "integration"] });
      toast.success(t("whatsapp.saved"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("whatsapp.saveFailed"))),
  });

  const isConnected = !!integrationQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("whatsapp.title")}</h1>

      <DataState isLoading={integrationQuery.isLoading} isError={integrationQuery.isError} error={integrationQuery.error}>
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("whatsapp.connectionTitle")}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="flex flex-col gap-4"
            >
              <TextField
                label={t("whatsapp.phoneNumberIdLabel")}
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
              />
              <TextField label={t("whatsapp.wabaIdLabel")} value={wabaId} onChange={(e) => setWabaId(e.target.value)} />
              <TextField
                label={t("whatsapp.accessTokenLabel")}
                type="password"
                placeholder={isConnected ? t("whatsapp.accessTokenPlaceholderKeep") : t("whatsapp.accessTokenPlaceholderNew")}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <TextField
                label={t("whatsapp.templateNameLabel")}
                placeholder="hello_test"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <TextField
                label={t("whatsapp.templateLanguageLabel")}
                placeholder="ar"
                value={templateLanguage}
                onChange={(e) => setTemplateLanguage(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                {t("whatsapp.activeLabel")}
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={testMutation.isPending}
                  disabled={!phoneNumberId || !accessToken}
                  onClick={() => testMutation.mutate()}
                >
                  {t("whatsapp.testConnection")}
                </Button>
                <Button type="submit" isLoading={saveMutation.isPending} disabled={!phoneNumberId || !templateName}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("whatsapp.statusTitle")}</h2>
            {isConnected && integrationQuery.data ? (
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-slate-500">{t("whatsapp.templateNameLabel")}</p>
                  <p className="font-medium text-slate-900" dir="ltr">
                    {integrationQuery.data.templateName} ({integrationQuery.data.templateLanguage})
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("common.status")}</p>
                  <p className="font-medium text-slate-900">
                    {integrationQuery.data.isActive ? t("common.active") : t("common.inactive")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("whatsapp.updatedAtLabel")}</p>
                  <p className="font-medium text-slate-900">{new Date(integrationQuery.data.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("whatsapp.notConnected")}</p>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("whatsapp.messageLogsTitle")}</h2>
            <DataState
              isLoading={logsQuery.isLoading}
              isError={logsQuery.isError}
              error={logsQuery.error}
              isEmpty={(logsQuery.data?.length ?? 0) === 0}
              emptyMessage={t("whatsapp.noLogs")}
            >
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("whatsapp.logDateColumn")}</th>
                    <th className="px-3 py-2 font-medium">{t("whatsapp.logPhoneColumn")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.status")}</th>
                    <th className="px-3 py-2 font-medium">{t("whatsapp.logErrorColumn")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logsQuery.data?.map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2 text-slate-600">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-600" dir="ltr">
                        {log.customerPhone ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LOG_STATUS_CLASSES[log.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {log.status}
                        </span>
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
    </div>
  );
}
