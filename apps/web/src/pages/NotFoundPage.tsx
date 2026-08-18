import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{t("common.pageNotFound")}</h1>
      <p className="text-sm text-slate-500">{t("common.pageNotFoundSubtitle")}</p>
      <Link to="/dashboard" className="mt-2 text-sm font-medium text-slate-900 underline">
        {t("common.backToDashboard")}
      </Link>
    </div>
  );
}
