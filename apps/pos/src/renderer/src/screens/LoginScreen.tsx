import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../store/session-store";
import { useToastStore } from "../store/toast-store";

export function LoginScreen() {
  const { t } = useTranslation();
  const setSession = useSessionStore((s) => s.setSession);
  const pairing = useSessionStore((s) => s.pairing);
  const setPairing = useSessionStore((s) => s.setPairing);
  const push = useToastStore((s) => s.push);
  const [employeeCode, setEmployeeCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unpairing, setUnpairing] = useState(false);

  // Recovery path for a device whose server-side pairing no longer exists
  // (e.g. the backend database was reset) — without this, a "Device is not
  // paired" login error was a dead end: PairingScreen is only reachable
  // when pairing.paired is false, and there was no way to flip that from
  // here.
  async function rePair() {
    setUnpairing(true);
    try {
      await window.api.auth.unpairDevice();
      if (pairing) setPairing({ ...pairing, paired: false });
    } finally {
      setUnpairing(false);
    }
  }

  function pressDigit(d: string) {
    if (pin.length >= 8) return;
    setPin(pin + d);
  }

  async function submit() {
    setError(null);
    if (!employeeCode.trim() || pin.length < 4) {
      setError(t("login.errorMissingFields"));
      return;
    }
    setLoading(true);
    try {
      await window.api.auth.pinLogin({ employeeCode: employeeCode.trim(), pinCode: pin });
      const session = await window.api.auth.getSession();
      setSession(session);
      push("success", t("login.toastWelcome", { name: session.employeeName ?? "" }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(t("login.errorLoginFailed", { message }));
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="centered-screen">
      <div className="card narrow">
        <h2 style={{ marginTop: 0 }}>{t("login.title")}</h2>
        <div className="field">
          <label>{t("login.employeeCodeLabel")}</label>
          <input
            value={employeeCode}
            onChange={(e) => setEmployeeCode(e.target.value)}
            placeholder={t("login.employeeCodePlaceholder")}
            autoFocus
          />
        </div>
        <div className="field">
          <label>{t("login.pinLabel")}</label>
          <div className="pin-dots">
            {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
              <span key={i} className={`pin-dot ${i < pin.length ? "filled" : ""}`} />
            ))}
          </div>
        </div>
        <div className="pin-pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button type="button" key={d} onClick={() => pressDigit(d)}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => setPin("")}>
            {t("login.clear")}
          </button>
          <button type="button" onClick={() => pressDigit("0")}>
            0
          </button>
          <button type="button" onClick={() => setPin(pin.slice(0, -1))}>
            ⌫
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn primary block" onClick={submit} disabled={loading}>
          {loading ? t("login.signingIn") : t("login.signIn")}
        </button>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 8 }}
          onClick={() => void rePair()}
          disabled={unpairing}
        >
          {unpairing ? t("login.rePairing") : t("login.rePairDevice")}
        </button>
      </div>
    </div>
  );
}
