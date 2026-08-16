import { useTranslation } from "react-i18next";
import { useSessionStore, type Screen } from "../store/session-store";
import { useToastStore } from "../store/toast-store";
import { applyLanguageToDocument } from "../lib/language";
import type { AppLanguage } from "../../../shared/ipc";

export function Header({ onLogout }: { onLogout: () => void }) {
  const { t, i18n } = useTranslation();
  const pairing = useSessionStore((s) => s.pairing);
  const session = useSessionStore((s) => s.session);
  const screen = useSessionStore((s) => s.screen);
  const setScreen = useSessionStore((s) => s.setScreen);
  const syncStatus = useSessionStore((s) => s.syncStatus);
  const push = useToastStore((s) => s.push);

  const navItem = (id: Screen, label: string) => (
    <button className={`nav-btn ${screen === id ? "active" : ""}`} onClick={() => setScreen(id)}>
      {label}
    </button>
  );

  async function switchLanguage(language: AppLanguage) {
    if (i18n.language === language) return;
    await i18n.changeLanguage(language);
    applyLanguageToDocument(language);
    await window.api.settings.setLanguage(language);
  }

  return (
    <header className="app-header">
      <div className="left">
        <strong>Qassemiya POS</strong>
        <span style={{ opacity: 0.7, fontSize: 13 }}>
          {pairing?.branchId ? t("header.branchLabel", { id: pairing.branchId.slice(0, 8) }) : ""}
        </span>
        {navItem("till", t("header.navTill"))}
        {navItem("returns", t("header.navReturns"))}
        {navItem("settings", t("header.navSettings"))}
      </div>
      <div className="right">
        <span
          className="status-pill"
          title={syncStatus.lastError ?? undefined}
          onClick={async () => {
            const status = await window.api.sync.forceSync();
            useSessionStore.getState().setSyncStatus(status);
            push("info", t("header.toastSyncRequested"));
          }}
        >
          <span className={`status-dot ${syncStatus.online ? "online" : "offline"}`} />
          {syncStatus.online ? t("header.online") : t("header.offline")} · {t("header.unsynced", { count: syncStatus.unsyncedCount })}
          {syncStatus.isSyncing ? ` · ${t("header.syncing")}` : ""}
        </span>
        <span className="lang-switcher">
          <button
            type="button"
            className={`nav-btn ${i18n.language === "en" ? "active" : ""}`}
            onClick={() => void switchLanguage("en")}
          >
            {t("header.languageEnglish")}
          </button>
          <button
            type="button"
            className={`nav-btn ${i18n.language === "ar" ? "active" : ""}`}
            onClick={() => void switchLanguage("ar")}
          >
            {t("header.languageArabic")}
          </button>
        </span>
        <span>{session?.employeeName ?? ""}</span>
        <button className="nav-btn" onClick={onLogout}>
          {t("header.switchUser")}
        </button>
      </div>
    </header>
  );
}
