import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./en";
import { ar } from "./ar";

export type AppLanguage = "en" | "ar";
export const LANGUAGE_STORAGE_KEY = "qassemiya.language";

function storedLanguage(): AppLanguage {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "ar" ? "ar" : "en";
}

export function applyDocumentDirection(language: AppLanguage): void {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: storedLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes output.
  },
});

applyDocumentDirection(storedLanguage());

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  applyDocumentDirection(lng === "ar" ? "ar" : "en");
});

export default i18n;
