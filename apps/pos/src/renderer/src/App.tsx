import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "./store/session-store";
import { PairingScreen } from "./screens/PairingScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { TillScreen } from "./screens/TillScreen";
import { ReturnsScreen } from "./screens/ReturnsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { Header } from "./components/Header";
import { ToastHost } from "./components/ToastHost";
import { applyLanguageToDocument } from "./lib/language";

export default function App() {
  const { t, i18n } = useTranslation();
  const pairing = useSessionStore((s) => s.pairing);
  const session = useSessionStore((s) => s.session);
  const screen = useSessionStore((s) => s.screen);
  const setPairing = useSessionStore((s) => s.setPairing);
  const setSession = useSessionStore((s) => s.setSession);
  const setSyncStatus = useSessionStore((s) => s.setSyncStatus);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    (async () => {
      const [pairingState, sessionState, syncStatus, language] = await Promise.all([
        window.api.auth.getPairingState(),
        window.api.auth.getSession(),
        window.api.sync.getStatus(),
        window.api.settings.getLanguage(),
      ]);
      setPairing(pairingState);
      setSession(sessionState);
      setSyncStatus(syncStatus);
      await i18n.changeLanguage(language);
      applyLanguageToDocument(language);
      setBooted(true);
    })();

    const unsubscribe = window.api.sync.onStatusChanged((status) => setSyncStatus(status));
    return unsubscribe;
  }, [setPairing, setSession, setSyncStatus, i18n]);

  if (!booted) {
    return <div className="centered-screen">{t("app.loading")}</div>;
  }

  if (!pairing?.paired) {
    return (
      <>
        <PairingScreen />
        <ToastHost />
      </>
    );
  }

  if (!session?.loggedIn) {
    return (
      <>
        <LoginScreen />
        <ToastHost />
      </>
    );
  }

  async function handleLogout() {
    await window.api.auth.logout();
    setSession({ employeeId: null, employeeName: null, userId: null, loggedIn: false });
  }

  return (
    <>
      <Header onLogout={handleLogout} />
      <main className="main-content">
        {screen === "till" && <TillScreen />}
        {screen === "returns" && <ReturnsScreen />}
        {screen === "settings" && <SettingsScreen />}
      </main>
      <ToastHost />
    </>
  );
}
