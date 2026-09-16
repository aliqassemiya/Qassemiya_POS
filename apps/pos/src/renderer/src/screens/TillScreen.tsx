import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { uuidv7 } from "uuidv7";
import { useSessionStore } from "../store/session-store";
import { useCartStore, cartTotals } from "../store/cart-store";
import { useToastStore } from "../store/toast-store";
import { money } from "../lib/format";

const TAMARA_CODE = "TAMARA";
const TABBY_CODE = "TABBY";
const BNPL_CODES = new Set([TAMARA_CODE, TABBY_CODE]);
const BNPL_DISPLAY_NAMES: Record<string, string> = { [TAMARA_CODE]: "Tamara", [TABBY_CODE]: "Tabby" };

interface VariantResult {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  color: string | null;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  imageUrl: string | null;
  quantityOnHand: number | null;
}

interface PaymentMethodRow {
  id: string;
  code: string;
  name: string;
}

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
}

interface EmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
}

export function TillScreen() {
  const { t } = useTranslation();
  const pairing = useSessionStore((s) => s.pairing);
  const session = useSessionStore((s) => s.session);
  const online = useSessionStore((s) => s.syncStatus.online);
  const push = useToastStore((s) => s.push);

  const items = useCartStore((s) => s.items);
  const customer = useCartStore((s) => s.customer);
  const soldByEmployee = useCartStore((s) => s.soldByEmployee);
  const payments = useCartStore((s) => s.payments);
  const pendingOrderId = useCartStore((s) => s.pendingOrderId);
  const addItem = useCartStore((s) => s.addItem);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const setDiscount = useCartStore((s) => s.setDiscount);
  const removeItem = useCartStore((s) => s.removeItem);
  const setCustomer = useCartStore((s) => s.setCustomer);
  const setSoldByEmployee = useCartStore((s) => s.setSoldByEmployee);
  const addPayment = useCartStore((s) => s.addPayment);
  const updatePayment = useCartStore((s) => s.updatePayment);
  const removePayment = useCartStore((s) => s.removePayment);
  const setPendingOrderId = useCartStore((s) => s.setPendingOrderId);
  const clearCart = useCartStore((s) => s.clear);

  const [scanValue, setScanValue] = useState("");
  const [results, setResults] = useState<VariantResult[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  // Tracks which BNPL provider's session-creation call is in flight (or null)
  // so only that provider's button shows a loading state.
  const [creatingBnplFor, setCreatingBnplFor] = useState<string | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.api.catalog.listPaymentMethods().then(setPaymentMethods);
    window.api.catalog.listEmployees().then(setEmployees);
    scanRef.current?.focus();
  }, []);

  const totals = cartTotals(items);
  const paidTotal = payments.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
  const balanceDue = Math.round((totals.total - paidTotal) * 100) / 100;

  async function runSearch(query: string) {
    setScanValue(query);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const rows = await window.api.catalog.searchVariants(query.trim());
    setResults(rows);
  }

  function addVariantToCart(v: VariantResult) {
    addItem({
      productVariantId: v.id,
      sku: v.sku,
      name: v.productName + (v.size ? ` (${v.size}${v.color ? "/" + v.color : ""})` : ""),
      size: v.size,
      color: v.color,
      imageUrl: v.imageUrl,
      unitPrice: v.sellingPrice,
      taxRate: v.taxRate,
      costPriceSnapshot: v.costPrice,
    });
    setScanValue("");
    setResults([]);
    scanRef.current?.focus();
  }

  async function onScanKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const value = scanValue.trim();
    if (!value) return;
    // Try exact barcode lookup first (keyboard-wedge scanners send digits + Enter).
    const found = await window.api.catalog.lookupBarcode(value);
    if (found) {
      addVariantToCart(found);
      return;
    }
    if (results.length > 0) {
      addVariantToCart(results[0]);
      return;
    }
    push("error", t("till.errorNoProductFound", { value }));
  }

  async function searchCustomer(query: string) {
    setCustomerQuery(query);
    if (query.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    setCustomerResults(await window.api.catalog.searchCustomers(query.trim()));
  }

  function openNewCustomerForm() {
    // Staff always search by phone number first -- what they typed belongs
    // in the phone field, with name left blank for them to fill in manually.
    setNewCustomerName("");
    setNewCustomerPhone(customerQuery.trim());
    setNewCustomerEmail("");
    setShowNewCustomerForm(true);
  }

  async function submitNewCustomer() {
    if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
      push("error", t("till.errorNameAndPhoneRequired"));
      return;
    }
    setCreatingCustomer(true);
    try {
      const created = await window.api.catalog.createCustomer({
        fullName: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        email: newCustomerEmail.trim() || undefined,
      });
      setCustomer({ id: created.id, name: created.name, phone: newCustomerPhone.trim() });
      setShowNewCustomerForm(false);
      setCustomerResults([]);
      setCustomerQuery("");
      push("success", t("till.toastCustomerAdded"));
    } catch (err) {
      push("error", err instanceof Error ? err.message : t("till.errorCouldNotAddCustomer"));
    } finally {
      setCreatingCustomer(false);
    }
  }

  function addPaymentLine(method: PaymentMethodRow) {
    addPayment({ paymentMethodId: method.id, methodName: method.name, amount: Math.max(balanceDue, 0) });
  }

  /**
   * Unlike every other payment method, creating a Tamara/Tabby session is a
   * live, online-only network call -- it's literally what triggers the
   * provider's own SMS to the customer, so it cannot be queued for later
   * like the rest of an offline-first checkout. Reserves the order's id up
   * front so the same id becomes the real Order.id if checkout completes.
   */
  async function addBnplPaymentLine(method: PaymentMethodRow) {
    const providerName = BNPL_DISPLAY_NAMES[method.code] ?? method.name;
    if (!pairing?.branchId) {
      push("error", t("till.errorMissingSession"));
      return;
    }
    if (!online) {
      push("error", t("till.errorBnplRequiresInternet", { provider: providerName }));
      return;
    }
    if (!customer?.phone) {
      push("error", t("till.errorBnplRequiresCustomerPhone", { provider: providerName }));
      return;
    }
    const amount = Math.max(balanceDue, 0);
    if (amount <= 0) {
      push("error", t("till.errorBnplAmountInvalid", { provider: providerName }));
      return;
    }
    setCreatingBnplFor(method.code);
    try {
      const orderId = pendingOrderId ?? uuidv7();
      setPendingOrderId(orderId);
      let referenceNumber: string;
      if (method.code === TAMARA_CODE) {
        const result = await window.api.tamara.createCheckoutSession({
          orderReferenceId: orderId,
          branchId: pairing.branchId,
          amount,
          phoneNumber: customer.phone,
          items: items.map((i) => ({
            referenceId: i.productVariantId,
            name: i.name,
            sku: i.sku,
            quantity: i.quantity,
            totalAmount: i.lineTotal,
          })),
        });
        referenceNumber = result.checkoutId;
      } else {
        const result = await window.api.tabby.createCheckoutSession({
          orderReferenceId: orderId,
          branchId: pairing.branchId,
          amount,
          phoneNumber: customer.phone,
          items: items.map((i) => ({ title: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        });
        referenceNumber = result.sessionId;
      }
      addPayment({
        paymentMethodId: method.id,
        methodName: method.name,
        amount,
        referenceNumber,
        status: "PENDING",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      push("error", t("till.errorBnplSessionFailed", { provider: providerName, message }));
    } finally {
      setCreatingBnplFor(null);
    }
  }

  async function checkout() {
    if (!pairing?.branchId || !session?.userId) {
      push("error", t("till.errorMissingSession"));
      return;
    }
    if (items.length === 0) {
      push("error", t("till.errorCartEmpty"));
      return;
    }
    if (payments.length === 0 || paidTotal < totals.total - 0.001) {
      push("error", t("till.errorPaymentsMustCoverTotal"));
      return;
    }
    setCheckingOut(true);
    try {
      const result = await window.api.sales.checkout({
        id: pendingOrderId ?? undefined,
        branchId: pairing.branchId,
        cashierUserId: session.userId,
        soldByEmployeeId: soldByEmployee?.id ?? null,
        customerId: customer?.id ?? null,
        customerName: customer?.name,
        items: items.map((i) => ({
          productVariantId: i.productVariantId,
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
          taxAmount: i.taxAmount,
          lineTotal: i.lineTotal,
          costPriceSnapshot: i.costPriceSnapshot,
        })),
        payments: payments.map((p) => ({
          paymentMethodId: p.paymentMethodId,
          methodName: p.methodName,
          amount: p.amount,
          referenceNumber: p.referenceNumber,
          status: p.status,
        })),
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
      });
      push(
        "success",
        t("till.toastSaleComplete", { orderId: result.orderId.slice(0, 8) }) +
          (result.print?.ok ? "" : t("till.toastPrintIssueSuffix")),
      );
      clearCart();
      setCustomerQuery("");
      setCustomerResults([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      push("error", t("till.errorCheckoutFailed", { message }));
    } finally {
      setCheckingOut(false);
      scanRef.current?.focus();
    }
  }

  return (
    <div className="till-layout">
      <div className="panel">
        <input
          ref={scanRef}
          className="scan-input"
          placeholder={t("till.scanPlaceholder")}
          value={scanValue}
          onChange={(e) => void runSearch(e.target.value)}
          onKeyDown={(e) => void onScanKeyDown(e)}
        />
        {results.length > 0 && (
          <div className="search-results">
            {results.map((r) => (
              <div key={r.id} className="product-card" onClick={() => addVariantToCart(r)}>
                {r.imageUrl ? (
                  <img
                    src={r.imageUrl}
                    alt=""
                    className="product-card-image"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (placeholder) placeholder.style.display = "flex";
                    }}
                  />
                ) : null}
                <span className="product-card-image-empty" style={{ display: r.imageUrl ? "none" : "flex" }}>
                  🖼
                </span>
                <div className="product-card-body">
                  <span className="product-card-name">
                    {r.productName}
                    {r.size ? ` (${r.size}${r.color ? "/" + r.color : ""})` : ""}
                  </span>
                  <span className="product-card-sku">{r.sku}</span>
                  <div className="product-card-footer">
                    <span className="product-card-price">{money(r.sellingPrice)}</span>
                    {r.quantityOnHand !== null && <span className="product-card-qty">{t("till.qtyAbbrev", { qty: r.quantityOnHand })}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="cart-scroll">
          <table className="cart-table">
            <thead>
              <tr>
                <th>{t("till.tableItem")}</th>
                <th>{t("till.tableQty")}</th>
                <th>{t("till.tablePrice")}</th>
                <th>{t("till.tableDiscount")}</th>
                <th>{t("till.tableTotal")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.productVariantId}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {i.imageUrl && (
                        <img
                          src={i.imageUrl}
                          alt=""
                          className="cart-thumb"
                          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                        />
                      )}
                      <div>
                        {i.name}
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{i.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <input
                      className="qty-input"
                      type="number"
                      min={1}
                      value={i.quantity}
                      onChange={(e) => setQuantity(i.productVariantId, Number(e.target.value) || 1)}
                    />
                  </td>
                  <td>{money(i.unitPrice)}</td>
                  <td>
                    <input
                      className="discount-input"
                      type="number"
                      min={0}
                      value={i.discountAmount}
                      onChange={(e) => setDiscount(i.productVariantId, Number(e.target.value) || 0)}
                    />
                  </td>
                  <td>{money(i.lineTotal)}</td>
                  <td>
                    <button className="btn danger" onClick={() => removeItem(i.productVariantId)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: 24 }}>
                    {t("till.cartEmpty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>{t("till.salesperson")}</h3>
        <select
          className="field"
          style={{ width: "100%", padding: 8, marginBottom: 16 }}
          value={soldByEmployee?.id ?? ""}
          onChange={(e) => {
            const emp = employees.find((x) => x.id === e.target.value);
            setSoldByEmployee(emp ? { id: emp.id, fullName: emp.fullName } : null);
          }}
        >
          <option value="">{t("till.noSalesperson")}</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName} ({e.employeeCode})
            </option>
          ))}
        </select>

        <h3 style={{ marginTop: 0 }}>{t("till.customer")}</h3>
        {customer ? (
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span>{customer.name}</span>
            <button className="btn" onClick={() => setCustomer(null)}>
              {t("till.walkIn")}
            </button>
          </div>
        ) : showNewCustomerForm ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
            <input
              className="field"
              style={{ padding: 8 }}
              placeholder={t("till.fullNamePlaceholder")}
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
            />
            <input
              className="field"
              style={{ padding: 8 }}
              placeholder={t("till.phonePlaceholder")}
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
            />
            <input
              className="field"
              style={{ padding: 8 }}
              placeholder={t("till.emailPlaceholder")}
              value={newCustomerEmail}
              onChange={(e) => setNewCustomerEmail(e.target.value)}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn primary" disabled={creatingCustomer} onClick={() => void submitNewCustomer()}>
                {creatingCustomer ? t("till.addingCustomer") : t("till.addCustomer")}
              </button>
              <button className="btn" onClick={() => setShowNewCustomerForm(false)}>
                {t("till.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              className="field"
              style={{ width: "100%", padding: 8, marginBottom: 6 }}
              placeholder={t("till.searchCustomerPlaceholder")}
              value={customerQuery}
              onChange={(e) => void searchCustomer(e.target.value)}
            />
            {customerResults.length > 0 && (
              <div className="customer-results" style={{ maxHeight: 160 }}>
                {customerResults.map((c) => (
                  <div
                    key={c.id}
                    className="search-result-row"
                    onClick={() => {
                      setCustomer({ id: c.id, name: c.name, phone: c.phone });
                      setCustomerResults([]);
                      setCustomerQuery("");
                    }}
                  >
                    <span>{c.name}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{c.phone}</span>
                  </div>
                ))}
              </div>
            )}
            {customerQuery.trim().length >= 2 && customerResults.length === 0 && (
              <button className="btn" style={{ width: "100%" }} onClick={openNewCustomerForm}>
                + {t("till.addNewCustomer", { query: customerQuery.trim() })}
              </button>
            )}
          </>
        )}

        <div className="totals">
          <div className="totals-row">
            <span>{t("till.subtotal")}</span>
            <span>{money(totals.subtotal)}</span>
          </div>
          <div className="totals-row">
            <span>{t("till.discount")}</span>
            <span>-{money(totals.discountTotal)}</span>
          </div>
          <div className="totals-row">
            <span>{t("till.tax")}</span>
            <span>{money(totals.taxTotal)}</span>
          </div>
          <div className="totals-row grand">
            <span>{t("till.total")}</span>
            <span>{money(totals.total)}</span>
          </div>
        </div>

        <h3>{t("till.payment")}</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {paymentMethods.map((pm) =>
            BNPL_CODES.has(pm.code) ? (
              <button
                key={pm.id}
                className="btn"
                disabled={!online || creatingBnplFor !== null}
                title={!online ? t("till.errorBnplRequiresInternet", { provider: BNPL_DISPLAY_NAMES[pm.code] ?? pm.name }) : undefined}
                onClick={() => void addBnplPaymentLine(pm)}
              >
                {creatingBnplFor === pm.code
                  ? t("till.bnplCreatingSession", { provider: BNPL_DISPLAY_NAMES[pm.code] ?? pm.name })
                  : `+ ${pm.name}${!online ? ` (${t("till.offline")})` : ""}`}
              </button>
            ) : (
              <button key={pm.id} className="btn" onClick={() => addPaymentLine(pm)}>
                + {pm.name}
              </button>
            ),
          )}
        </div>
        {payments.map((p) => (
          <div key={p.key} className="payment-row">
            <span style={{ flex: 1 }}>
              {p.methodName}
              {p.status === "PENDING" && (
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-muted)" }}>
                  {t("till.awaitingBnplPayment")}
                </span>
              )}
            </span>
            <input
              type="number"
              value={p.amount}
              disabled={p.status === "PENDING"}
              onChange={(e) => updatePayment(p.key, Number(e.target.value) || 0, p.referenceNumber)}
            />
            <button
              className="btn danger"
              onClick={() => {
                removePayment(p.key);
                if (p.status === "PENDING") setPendingOrderId(null);
              }}
            >
              ×
            </button>
          </div>
        ))}
        <div className="totals-row">
          <span>{t("till.balanceDue")}</span>
          <span>{money(Math.max(balanceDue, 0))}</span>
        </div>
        {paidTotal > totals.total && (
          <div className="totals-row">
            <span>{t("till.change")}</span>
            <span>{money(paidTotal - totals.total)}</span>
          </div>
        )}

        <button className="btn primary block" style={{ marginTop: 16 }} onClick={checkout} disabled={checkingOut}>
          {checkingOut ? t("till.processing") : t("till.charge")}
        </button>
      </div>
    </div>
  );
}
