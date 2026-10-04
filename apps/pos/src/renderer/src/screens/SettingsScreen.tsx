import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSessionStore } from "../store/session-store";
import { useToastStore } from "../store/toast-store";

export function SettingsScreen() {
  const { t } = useTranslation();
  const pairing = useSessionStore((s) => s.pairing);
  const push = useToastStore((s) => s.push);
  const [interfaceTarget, setInterfaceTarget] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.api.printer.getSettings().then((s) => {
      setInterfaceTarget(s.interfaceTarget);
      setLoading(false);
    });
  }, []);

  async function save() {
    await window.api.printer.setSettings({ interfaceTarget });
    push("success", t("settings.toastSettingsSaved"));
  }

  async function testPrint() {
    const result = await window.api.printer.printReceipt({
      branchName: t("settings.testBranchName"),
      orderId: "TEST-0000",
      cashierName: t("settings.testCashierName"),
      createdAt: new Date().toISOString(),
      items: [{ name: t("settings.testItemName"), sku: "SKU-TEST", quantity: 1, unitPrice: 10, lineTotal: 10 }],
      subtotal: 10,
      discountTotal: 0,
      taxTotal: 1.5,
      total: 11.5,
      payments: [{ methodName: "CASH", amount: 11.5 }],
    });
    push(
      result.ok ? "success" : "error",
      result.ok ? t("settings.toastPrintSent", { target: result.target }) : t("settings.toastPrintFailed", { error: result.error }),
    );
  }

  async function testDrawer() {
    const result = await window.api.printer.openCashDrawer();
    push(result.ok ? "success" : "error", result.ok ? t("settings.toastDrawerSent") : t("settings.toastDrawerFailed", { error: result.error }));
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>{t("settings.title")}</h2>

      <h3>{t("settings.device")}</h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {t("settings.apiUrlLine", { value: pairing?.apiUrl ?? "—" })}
        <br />
        {t("settings.branchLine", { code: pairing?.branchCode ?? "—", name: pairing?.branchName ?? "—" })}
        <br />
        {t("settings.deviceLine", { name: pairing?.deviceName ?? "—", uuid: pairing?.deviceUuid?.slice(0, 8) ?? "—" })}
      </p>

      <h3>{t("settings.receiptPrinter")}</h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        <Trans i18nKey="settings.printerDescription" components={{ code: <code /> }} />
      </p>
      {!loading && (
        <div className="field">
          <label>{t("settings.printerInterfaceLabel")}</label>
          <input
            value={interfaceTarget}
            onChange={(e) => setInterfaceTarget(e.target.value)}
            placeholder={t("settings.printerInterfacePlaceholder")}
          />
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn primary" onClick={save}>
          {t("settings.save")}
        </button>
        <button className="btn" onClick={testPrint}>
          {t("settings.testPrint")}
        </button>
        <button className="btn" onClick={testDrawer}>
          {t("settings.testCashDrawer")}
        </button>
      </div>
    </div>
  );
}
