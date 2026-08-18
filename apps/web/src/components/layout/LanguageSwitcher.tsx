import { useTranslation } from "react-i18next";
import { applyDocumentDirection, type AppLanguage } from "@/i18n";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  async function switchLanguage(language: AppLanguage) {
    if (i18n.language === language) return;
    await i18n.changeLanguage(language);
    applyDocumentDirection(language);
  }

  return (
    <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs font-medium">
      <button
        type="button"
        onClick={() => void switchLanguage("en")}
        className={`px-2 py-1 ${i18n.language === "en" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => void switchLanguage("ar")}
        className={`px-2 py-1 ${i18n.language === "ar" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}
      >
        AR
      </button>
    </div>
  );
}
