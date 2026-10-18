import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSessionStore } from "../store/session-store";
import { useToastStore } from "../store/toast-store";
import { money, formatDateTime } from "../lib/format";

interface OrderSummary {
  id: string;
  orderNumber: string | null;
  createdAt: string;
  total: number;
  status: string;
  syncedAt: string | null;
}

interface ServerOrderSummary {
  id: string;
  orderNumber: string | null;
  branchName: string;
  createdAt: string;
  total: number;
}

interface LocalShopifyOrderSummary {
  id: string;
  orderNumber: string;
  shopifyCreatedAt: string;
  currentTotalPrice: number;
  currency: string;
  customerName: string | null;
}

interface LocalShopifyOrderItemRow {
  id: string;
  sku: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  alreadyReturned: number;
}

interface LocalShopifyOrderWithItems {
  id: string;
  orderNumber: string;
  shopifyCreatedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  items: LocalShopifyOrderItemRow[];
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
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [refundPaymentMethodId, setRefundPaymentMethodId] = useState("");
  const [serverQuery, setServerQuery] = useState("");
  const [serverResults, setServerResults] = useState<ServerOrderSummary[]>([]);
  const [searchingServer, setSearchingServer] = useState(false);

  const [mode, setMode] = useState<"IN_STORE" | "ONLINE">("IN_STORE");
  const [onlineQuery, setOnlineQuery] = useState("");
  const [onlineResults, setOnlineResults] = useState<LocalShopifyOrderSummary[]>([]);
  const [searchingOnline, setSearchingOnline] = useState(false);
  const [selectedShopifyOrder, setSelectedShopifyOrder] = useState<LocalShopifyOrderWithItems | null>(null);
  const [onlineReturnQty, setOnlineReturnQty] = useState<Record<string, number>>({});
  const [onlineReason, setOnlineReason] = useState("");
  const [processingOnline, setProcessingOnline] = useState(false);

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
      setSelectedOrderNumber(data.orderNumber ?? null);
      setSelectedBranchName(data.branchName ?? null);
      setSelectedCustomerName(data.customerName ?? null);
      setSelectedCustomerPhone(data.customerPhone ?? null);
      setReturnQty({});
      setRestock(Object.fromEntries(data.items.map((i: OrderItemRow) => [i.id, true])));
    } else {
      setSelectedOrderId(null);
      push("error", t("returns.errorOrderNotFound"));
    }
  }

  async function searchServer() {
    if (!serverQuery.trim()) return;
    setSearchingServer(true);
    try {
      const results = await window.api.sales.searchServerOrders(serverQuery.trim());
      setServerResults(results);
      if (results.length === 0) push("error", t("returns.errorNoServerResults"));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      push("error", t("returns.errorServerSearchFailed", { message }));
    } finally {
      setSearchingServer(false);
    }
  }

  function maxReturnable(item: OrderItemRow): number {
    return Math.max(item.quantity - item.alreadyReturned, 0);
  }

  // Live preview of the refund total, using the exact same per-line formula
  // processReturn() uses when actually submitting -- kept in sync so what's
  // shown here always matches what gets charged.
  const currentReturnTotal =
    Math.round(
      items.reduce((sum, i) => {
        const qty = Math.min(returnQty[i.id] ?? 0, maxReturnable(i));
        if (qty <= 0) return sum;
        return sum + (i.lineTotal / i.quantity) * qty;
      }, 0) * 100,
    ) / 100;

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
      setSelectedOrderNumber(null);
      setSelectedBranchName(null);
      setSelectedCustomerName(null);
      setSelectedCustomerPhone(null);
      setItems([]);
      setReason("");
      setRefundPaymentMethodId("");
      setServerResults([]);
      setServerQuery("");
      const refreshed = await window.api.sales.listOrders(pairing.branchId);
      setOrders(refreshed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      push("error", t("returns.errorReturnFailed", { message }));
    } finally {
      setProcessing(false);
    }
  }

  async function searchOnline() {
    if (!onlineQuery.trim()) return;
    setSearchingOnline(true);
    try {
      const results = await window.api.sales.searchLocalShopifyOrders(onlineQuery.trim());
      setOnlineResults(results);
      if (results.length === 0) push("error", t("returns.noOnlineResults"));
    } finally {
      setSearchingOnline(false);
    }
  }

  async function selectShopifyOrder(id: string) {
    const data = await window.api.sales.getShopifyOrder(id);
    if (data) {
      setSelectedShopifyOrder(data);
      setOnlineReturnQty({});
    } else {
      setSelectedShopifyOrder(null);
      push("error", t("returns.errorOrderNotFound"));
    }
  }

  function maxOnlineReturnable(item: LocalShopifyOrderItemRow): number {
    return Math.max(item.quantity - item.alreadyReturned, 0);
  }

  async function processOnlineReturn() {
    if (!selectedShopifyOrder || !pairing?.branchId || !session?.userId) return;
    const linesToReturn = selectedShopifyOrder.items
      .filter((i) => (onlineReturnQty[i.id] ?? 0) > 0)
      .map((i) => ({
        shopifyOrderItemId: i.id,
        name: i.title,
        sku: i.sku ?? "",
        quantity: Math.min(onlineReturnQty[i.id] ?? 0, maxOnlineReturnable(i)),
      }))
      .filter((l) => l.quantity > 0);

    if (linesToReturn.length === 0) {
      push("error", t("returns.errorSelectItem"));
      return;
    }

    setProcessingOnline(true);
    try {
      await window.api.sales.createShopifyReturn({
        shopifyOrderId: selectedShopifyOrder.id,
        shopifyOrderNumber: selectedShopifyOrder.orderNumber,
        customerName: selectedShopifyOrder.customerName ?? undefined,
        branchId: pairing.branchId,
        processedByUserId: session.userId,
        reason: onlineReason || undefined,
        items: linesToReturn,
      });
      push("success", t("returns.toastShopifyReturnProcessed"));
      setSelectedShopifyOrder(null);
      setOnlineReturnQty({});
      setOnlineReason("");
      setOnlineResults([]);
      setOnlineQuery("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      push("error", t("returns.errorShopifyReturnFailed", { message }));
    } finally {
      setProcessingOnline(false);
    }
  }

  return (
    <div className="till-layout">
      <div className="panel">
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button
            className={`btn ${mode === "IN_STORE" ? "primary" : ""}`}
            style={{ flex: 1 }}
            onClick={() => setMode("IN_STORE")}
          >
            {t("returns.toggleInStore")}
          </button>
          <button
            className={`btn ${mode === "ONLINE" ? "primary" : ""}`}
            style={{ flex: 1 }}
            onClick={() => setMode("ONLINE")}
          >
            {t("returns.toggleOnline")}
          </button>
        </div>

        {mode === "IN_STORE" && (
          <>
            <h3 style={{ marginTop: 0 }}>{t("returns.searchAnyBranch")}</h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input
                className="field"
                style={{ flex: 1, padding: 8 }}
                placeholder={t("returns.searchAnyBranchPlaceholder")}
                value={serverQuery}
                onChange={(e) => setServerQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void searchServer()}
              />
              <button className="btn" onClick={() => void searchServer()} disabled={searchingServer}>
                {searchingServer ? t("returns.searching") : t("returns.search")}
              </button>
            </div>
            {serverResults.length > 0 && (
              <div className="order-list" style={{ maxHeight: 240, flexShrink: 0, marginBottom: 16 }}>
                {serverResults.map((o) => (
                  <div key={o.id} className={`order-row ${selectedOrderId === o.id ? "selected" : ""}`} onClick={() => selectOrder(o.id)}>
                    <div>
                      <div>#{o.orderNumber ?? o.id.slice(0, 8)}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {o.branchName} · {formatDateTime(o.createdAt)}
                      </div>
                    </div>
                    <div style={{ textAlign: "end" }}>{money(o.total)}</div>
                  </div>
                ))}
              </div>
            )}

            <h3 style={{ marginTop: 0 }}>{t("returns.recentOrders")}</h3>
            <div className="order-list" style={{ flex: 1, minHeight: 0 }}>
              {orders.map((o) => (
                <div key={o.id} className={`order-row ${selectedOrderId === o.id ? "selected" : ""}`} onClick={() => selectOrder(o.id)}>
                  <div>
                    <div>#{o.orderNumber ?? o.id.slice(0, 8)}</div>
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
          </>
        )}

        {mode === "ONLINE" && (
          <>
            <h3 style={{ marginTop: 0 }}>{t("returns.toggleOnline")}</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -6 }}>{t("returns.onlineOrderSearchHint")}</p>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <input
                className="field"
                style={{ flex: 1, padding: 8 }}
                placeholder={t("returns.onlineOrderSearchPlaceholder")}
                value={onlineQuery}
                onChange={(e) => setOnlineQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void searchOnline()}
              />
              <button className="btn" onClick={() => void searchOnline()} disabled={searchingOnline}>
                {searchingOnline ? t("returns.searching") : t("returns.search")}
              </button>
            </div>
            <div className="order-list" style={{ flex: 1, minHeight: 0 }}>
              {onlineResults.map((o) => (
                <div
                  key={o.id}
                  className={`order-row ${selectedShopifyOrder?.id === o.id ? "selected" : ""}`}
                  onClick={() => selectShopifyOrder(o.id)}
                >
                  <div>
                    <div>#{o.orderNumber}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {o.customerName ?? t("returns.walkInCustomer")} · {formatDateTime(o.shopifyCreatedAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: "end" }}>{money(o.currentTotalPrice)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {mode === "IN_STORE" && (
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t("returns.processReturn")}</h3>
        {!selectedOrderId && <p style={{ color: "var(--text-muted)" }}>{t("returns.selectOrderHint")}</p>}
        {selectedOrderId && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>
                {t("returns.orderNumberLabel")} #{selectedOrderNumber ?? selectedOrderId.slice(0, 8)}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {selectedCustomerName
                  ? `${selectedCustomerName}${selectedCustomerPhone ? ` · ${selectedCustomerPhone}` : ""}`
                  : t("returns.walkInCustomer")}
              </div>
              {selectedBranchName && (
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {t("returns.originallySoldAt", { branch: selectedBranchName })}
                </div>
              )}
            </div>
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
            <div className="totals-row grand" style={{ marginTop: 12 }}>
              <span>{t("returns.refundTotalLabel")}</span>
              <span>{money(currentReturnTotal)}</span>
            </div>
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
      )}

      {mode === "ONLINE" && (
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t("returns.processOnlineReturn")}</h3>
        {!selectedShopifyOrder && <p style={{ color: "var(--text-muted)" }}>{t("returns.selectOnlineOrderHint")}</p>}
        {selectedShopifyOrder && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600 }}>
                {t("returns.onlineOrderLabel")} #{selectedShopifyOrder.orderNumber}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {selectedShopifyOrder.customerName
                  ? `${selectedShopifyOrder.customerName}${selectedShopifyOrder.customerPhone ? ` · ${selectedShopifyOrder.customerPhone}` : ""}`
                  : t("returns.walkInCustomer")}
              </div>
            </div>
            <table className="cart-table">
              <thead>
                <tr>
                  <th>{t("returns.tableItem")}</th>
                  <th>{t("returns.tableSold")}</th>
                  <th>{t("returns.tableAlreadyReturned")}</th>
                  <th>{t("returns.tableReturnQty")}</th>
                </tr>
              </thead>
              <tbody>
                {selectedShopifyOrder.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.title}
                      {i.sku && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{i.sku}</div>}
                    </td>
                    <td>{i.quantity}</td>
                    <td>{i.alreadyReturned}</td>
                    <td>
                      <input
                        className="qty-input"
                        type="number"
                        min={0}
                        max={maxOnlineReturnable(i)}
                        value={onlineReturnQty[i.id] ?? 0}
                        onChange={(e) =>
                          setOnlineReturnQty({
                            ...onlineReturnQty,
                            [i.id]: Math.min(Number(e.target.value) || 0, maxOnlineReturnable(i)),
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="field" style={{ marginTop: 12 }}>
              <label>{t("returns.reasonLabel")}</label>
              <input value={onlineReason} onChange={(e) => setOnlineReason(e.target.value)} />
            </div>
            <button className="btn primary block" onClick={processOnlineReturn} disabled={processingOnline}>
              {processingOnline ? t("returns.processing") : t("returns.processOnlineReturn")}
            </button>
          </>
        )}
      </div>
      )}
    </div>
  );
}
