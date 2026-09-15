import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getTamaraIntegration, upsertTamaraIntegration } from "@/api/tamara";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

export function TamaraSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const integrationQuery = useQuery({ queryKey: ["tamara", "integration"], queryFn: getTamaraIntegration });

  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (integrationQuery.data) {
      setEnvironment(integrationQuery.data.environment);
      setIsActive(integrationQuery.data.isActive);
    }
  }, [integrationQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => upsertTamaraIntegration({ apiKey: apiKey || undefined, environment, isActive }),
    onSuccess: () => {
      setApiKey("");
      queryClient.invalidateQueries({ queryKey: ["tamara", "integration"] });
      toast.success(t("tamara.saved"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("tamara.saveFailed"))),
  });

  const isConnected = !!integrationQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("tamara.title")}</h1>

      <DataState isLoading={integrationQuery.isLoading} isError={integrationQuery.isError} error={integrationQuery.error}>
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("tamara.connectionTitle")}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="flex flex-col gap-4"
            >
              <TextField
                label={t("tamara.apiKeyLabel")}
                type="password"
                placeholder={isConnected ? t("tamara.apiKeyPlaceholderKeep") : t("tamara.apiKeyPlaceholderNew")}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("tamara.environmentLabel")}</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as "sandbox" | "production")}
                >
                  <option value="sandbox">{t("tamara.environmentSandbox")}</option>
                  <option value="production">{t("tamara.environmentProduction")}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                {t("tamara.activeLabel")}
              </label>
              <div className="flex gap-2">
                <Button type="submit" isLoading={saveMutation.isPending} disabled={!isConnected && !apiKey}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("tamara.statusTitle")}</h2>
            {isConnected && integrationQuery.data ? (
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-slate-500">{t("tamara.environmentLabel")}</p>
                  <p className="font-medium text-slate-900" dir="ltr">
                    {integrationQuery.data.environment}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("common.status")}</p>
                  <p className="font-medium text-slate-900">
                    {integrationQuery.data.isActive ? t("common.active") : t("common.inactive")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("tamara.updatedAtLabel")}</p>
                  <p className="font-medium text-slate-900">{new Date(integrationQuery.data.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("tamara.notConnected")}</p>
            )}
          </section>
        </div>
      </DataState>
    </div>
  );
}
