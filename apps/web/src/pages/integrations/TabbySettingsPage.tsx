import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getTabbyIntegration, upsertTabbyIntegration } from "@/api/tabby";
import { DataState } from "@/components/ui/DataState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/store/toastStore";
import { getErrorMessage } from "@/lib/errorMessage";

export function TabbySettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const integrationQuery = useQuery({ queryKey: ["tabby", "integration"], queryFn: getTabbyIntegration });

  const [secretKey, setSecretKey] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [region, setRegion] = useState<"KSA" | "UAE">("KSA");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (integrationQuery.data) {
      setMerchantCode(integrationQuery.data.merchantCode);
      setRegion(integrationQuery.data.region);
      setIsActive(integrationQuery.data.isActive);
    }
  }, [integrationQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => upsertTabbyIntegration({ secretKey: secretKey || undefined, merchantCode, region, isActive }),
    onSuccess: () => {
      setSecretKey("");
      queryClient.invalidateQueries({ queryKey: ["tabby", "integration"] });
      toast.success(t("tabby.saved"));
    },
    onError: (err) => toast.error(getErrorMessage(err, t("tabby.saveFailed"))),
  });

  const isConnected = !!integrationQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-slate-900">{t("tabby.title")}</h1>

      <DataState isLoading={integrationQuery.isLoading} isError={integrationQuery.isError} error={integrationQuery.error}>
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("tabby.connectionTitle")}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="flex flex-col gap-4"
            >
              <TextField
                label={t("tabby.secretKeyLabel")}
                type="password"
                placeholder={isConnected ? t("tabby.secretKeyPlaceholderKeep") : t("tabby.secretKeyPlaceholderNew")}
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
              />
              <TextField
                label={t("tabby.merchantCodeLabel")}
                value={merchantCode}
                onChange={(e) => setMerchantCode(e.target.value)}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">{t("tabby.regionLabel")}</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as "KSA" | "UAE")}
                >
                  <option value="KSA">{t("tabby.regionKsa")}</option>
                  <option value="UAE">{t("tabby.regionUae")}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                {t("tabby.activeLabel")}
              </label>
              <div className="flex gap-2">
                <Button type="submit" isLoading={saveMutation.isPending} disabled={!merchantCode || (!isConnected && !secretKey)}>
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">{t("tabby.statusTitle")}</h2>
            {isConnected && integrationQuery.data ? (
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-slate-500">{t("tabby.merchantCodeLabel")}</p>
                  <p className="font-medium text-slate-900" dir="ltr">
                    {integrationQuery.data.merchantCode}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("tabby.regionLabel")}</p>
                  <p className="font-medium text-slate-900" dir="ltr">
                    {integrationQuery.data.region}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("common.status")}</p>
                  <p className="font-medium text-slate-900">
                    {integrationQuery.data.isActive ? t("common.active") : t("common.inactive")}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">{t("tabby.updatedAtLabel")}</p>
                  <p className="font-medium text-slate-900">{new Date(integrationQuery.data.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("tabby.notConnected")}</p>
            )}
          </section>
        </div>
      </DataState>
    </div>
  );
}
