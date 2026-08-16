import type { AppLanguage } from "../../../shared/ipc";

/** Sets `dir`/`lang` on the document root so RTL layout mirrors immediately, no reload required. */
export function applyLanguageToDocument(language: AppLanguage): void {
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = language;
}
