import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../store/session-store";
import { useToastStore } from "../store/toast-store";
import { money, formatDateTime } from "../lib/format";

interface OrderSummary {
  id: string;
  createdAt: string;
  total: number;
  status: string;
  syncedAt: string | null;
}

interface OrderItemRow {
  id: string;
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  sku: string;
  productName: string;
  alreadyReturned: number;
}

interface PaymentMethodRow {
  id: string;
  code: string;
  name: string;
}

export function ReturnsScreen() {
  const { t } = useTranslation();
  const pairing = useSessionStore((s) => s.pairing);
  const session = useSessionStore((s) => s.session);
  const push = useToastStore((s) => s.push);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [refundPaymentMethodId, setRefundPaymentMethodId] = useState("");

  useEffect(() => {
    if (pairing?.branchId) {
      window.api.sales.listOrders(pairing.branchId).then(setOrders);
    }
    window.api.catalog.listPaymentMethods().then(setPaymentMethods);
  }, [pairing?.branchId]);

  async function selectOrder(orderId: string) {
    setSelectedOrderId(orderId);
    const data = await window.api.sales.getOrder(orderId);
    if (data) {
      setItems(data.items);
      setReturnQty({});
      setRestock(Object.fromEntries(data.items.map((i: OrderItemRow) => [i.id, true])));
    }
  }

  function maxReturnable(item: OrderItemRow): number {
    return Math.max(item.quantity - item.alreadyReturned, 0);
  }

  async function processReturn() {
    if (!selectedOrderId || !pairing?.branchId || !session?.userId) return;
    const linesToReturn = items
      .filter((i) => (returnQty[i.id] ?? 0) > 0)
      .map((i) => {
        const qty = Math.min(returnQty[i.id] ?? 0, maxReturnable(i));
        const unitRefund = i.lineTotal / i.quantity;
        return {
          orderItemId: i.id,
          productVariantId: i.productVariantId,
          quantity: qty,
          refundAmount: Math.round(unitRefund * qty * 100) / 100,
          restocked: restock[i.id] ?? true,
        };
      })
      .filter((l) => l.quantity > 0);

    if (linesToReturn.length === 0) {
      push("error", t("returns.errorSelectItem"));
      return;
    }
    if (!refundPaymentMethodId) {
      push("error", t("returns.errorSelectRefundMethod"));
      return;
    }

    setProcessing(true);
    try {
      const totalRefundAmount = Math.round(linesToReturn.reduce((sum, l) => sum + l.refundAmount, 0) * 100) / 100;
      await window.api.sales.createReturn({
        orderId: selectedOrderId,
        branchId: pairing.branchId,
        processedByUserId: session.userId,
        refundPaymentMethodId,
        reason: reason || undefined,
        items: linesToReturn,
        totalRefundAmount,
      });
      push("success", t("returns.toastReturnProcessed", { amount: money(totalRefundAmount) }));
      setSelectedOrderId(null);
      setItems([]);
      setReason("");
      setRefundPaymentMethodId("");
      const refreshed = await window.api.sales.listOrders(pairing.branchId);
      setOrders(refreshed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      push("error", t("returns.errorReturnFailed", { message }));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="till-layout">
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t("returns.recentOrders")}</h3>
        <div className="order-list">
          {orders.map((o) => (
            <div key={o.id} className={`order-row ${selectedOrderId === o.id ? "selected" : ""}`} onClick={() => selectOrder(o.id)}>
              <div>
                <div>{o.id.slice(0, 8)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatDateTime(o.createdAt)}</div>
              </div>
              <div style={{ textAlign: "end" }}>
                <div>{money(o.total)}</div>
                <span className={`badge ${o.syncedAt ? "synced" : "pending"}`}>{o.syncedAt ? t("returns.synced") : t("returns.pending")}</span>
              </div>
            </div>
          ))}
          {orders.length === 0 && <div style={{ padding: 16, color: "var(--text-muted)" }}>{t("returns.noOrders")}</div>}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t("returns.processReturn")}</h3>
        {!selectedOrderId && <p style={{ color: "var(--text-muted)" }}>{t("returns.selectOrderHint")}</p>}
        {selectedOrderId && (
          <>
            <table className="cart-table">
              <thead>
                <tr>
                  <th>{t("returns.tableItem")}</th>
                  <th>{t("returns.tableSold")}</th>
                  <th>{t("returns.tableReturnQty")}</th>
                  <th>{t("returns.tableRestock")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.productName}
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{i.sku}</div>
                    </td>
                    <td>{i.quantity}</td>
                    <td>
                      <input
                        className="qty-input"
                        type="number"
                        min={0}
                        max={maxReturnable(i)}
                        value={returnQty[i.id] ?? 0}
                        onChange={(e) =>
                          setReturnQty({ ...returnQty, [i.id]: Math.min(Number(e.target.value) || 0, maxReturnable(i)) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={restock[i.id] ?? true}
                        onChange={(e) => setRestock({ ...restock, [i.id]: e.target.checked })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="field" style={{ marginTop: 12 }}>
              <label>{t("returns.refundMethodLabel")}</label>
              <select value={refundPaymentMethodId} onChange={(e) => setRefundPaymentMethodId(e.target.value)}>
                <option value="">{t("returns.refundMethodPlaceholder")}</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t("returns.reasonLabel")}</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <button className="btn primary block" onClick={processReturn} disabled={processing}>
              {processing ? t("returns.processing") : t("returns.processReturn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
