import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../store/session-store";
import { useToastStore } from "../store/toast-store";

interface PublicBranch {
  id: string;
  code: string;
  name: string;
}

export function PairingScreen() {
  const { t } = useTranslation();
  const setPairing = useSessionStore((s) => s.setPairing);
  const push = useToastStore((s) => s.push);
  const [apiUrl, setApiUrl] = useState("http://localhost:3000");
  const [branches, setBranches] = useState<PublicBranch[] | null>(null);
  const [branchId, setBranchId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadBranches() {
    setError(null);
    setLoadingBranches(true);
    try {
      const list = await window.api.auth.listPublicBranches(apiUrl.trim());
      setBranches(list);
      if (list.length > 0) setBranchId(list[0].id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(t("pairing.errorLoadBranches", { message }));
      setBranches(null);
    } finally {
      setLoadingBranches(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!branchId || !deviceName.trim()) {
      setError(t("pairing.errorMissingFields"));
      return;
    }
    const selectedBranch = branches?.find((b) => b.id === branchId);
    if (!selectedBranch) {
      setError(t("pairing.errorMissingFields"));
      return;
    }
    setLoading(true);
    try {
      await window.api.auth.pairDevice({
        apiUrl: apiUrl.trim(),
        branchId,
        branchCode: selectedBranch.code,
        branchName: selectedBranch.name,
        deviceName: deviceName.trim(),
      });
      const state = await window.api.auth.getPairingState();
      setPairing(state);
      push("success", t("pairing.toastDevicePaired"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(t("pairing.errorPairingFailed", { message }));
      push("error", t("pairing.toastPairingFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="centered-screen">
      <form className="card narrow" onSubmit={submit}>
        <h2 style={{ marginTop: 0 }}>{t("pairing.title")}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{t("pairing.subtitle")}</p>
        <div className="field">
          <label>{t("pairing.apiUrlLabel")}</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              style={{ flex: 1 }}
              value={apiUrl}
              onChange={(e) => {
                setApiUrl(e.target.value);
                setBranches(null);
              }}
              placeholder={t("pairing.apiUrlPlaceholder")}
            />
            <button className="btn" type="button" disabled={loadingBranches} onClick={() => void loadBranches()}>
              {loadingBranches ? t("pairing.loadingBranches") : branches ? t("pairing.reload") : t("pairing.loadBranches")}
            </button>
          </div>
        </div>
        <div className="field">
          <label>{t("pairing.branchLabel")}</label>
          {branches ? (
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {branches.length === 0 && <option value="">{t("pairing.noBranchesFound")}</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0" }}>{t("pairing.loadBranchesHint")}</p>
          )}
        </div>
        <div className="field">
          <label>{t("pairing.deviceNameLabel")}</label>
          <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder={t("pairing.deviceNamePlaceholder")} />
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn primary block" type="submit" disabled={loading || !branches?.length}>
          {loading ? t("pairing.pairingInProgress") : t("pairing.pairDevice")}
        </button>
      </form>
    </div>
  );
}
