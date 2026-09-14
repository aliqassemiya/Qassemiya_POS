// Renders an Arabic-only, mobile-friendly invoice page for GET /invoices/:id
// — opened directly in a customer's phone browser from the WhatsApp link, so
// no app font-embedding is needed here (unlike PDF rendering): the device's
// own OS font already shapes Arabic correctly in a real browser. Content
// mirrors what the POS thermal receipt already prints
// (apps/pos/src/main/printer/printer-bridge.ts's ReceiptData shape) plus the
// branch's address/VAT number, which the paper receipt doesn't include.

export interface InvoiceOrder {
  id: string;
  orderNumber: string | null;
  createdAt: Date;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  status: string;
  branch: { name: string; nameAr: string | null; address: string | null; vatNumber: string | null };
  cashierUser: { fullName: string } | null;
  soldByEmployee: { fullName: string } | null;
  customer: { fullName: string; phone: string | null } | null;
  items: Array<{
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    productVariant: { sku: string; size: string | null; color: string | null; product: { name: string } };
  }>;
  payments: Array<{ amount: number; paymentMethod: { name: string } }>;
  /** Pre-rendered "data:image/png;base64,..." string -- see zatca-qr.ts. */
  zatcaQrDataUrl: string;
}

// Fixed company-wide registration numbers (same for every branch under the
// single legal entity) — not stored on Branch since they don't vary per
// branch, unlike vatNumber.
const CR_NUMBER = "1010135385";
const SAUDI_BUSINESS_NUMBER = "0000070465";

function currency(n: number): string {
  return new Intl.NumberFormat("en-SA", { style: "currency", currency: "SAR" }).format(n);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function buildInvoiceHtml(order: InvoiceOrder): string {
  const branchNameAr = order.branch.nameAr ?? order.branch.name;
  const displayNumber = order.orderNumber ?? order.id.slice(0, 8);
  const itemRows = order.items
    .map((item) => {
      const variantLabel = [item.productVariant.size, item.productVariant.color].filter(Boolean).join(" / ");
      return `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(item.productVariant.product.name)}</div>
            <div class="item-meta">${escapeHtml(item.productVariant.sku)}${variantLabel ? ` &middot; ${escapeHtml(variantLabel)}` : ""}</div>
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${currency(item.unitPrice)}</td>
          <td class="num">${currency(item.lineTotal)}</td>
        </tr>`;
    })
    .join("");

  const paymentRows = order.payments
    .map((p) => `<div class="row"><span>${escapeHtml(p.paymentMethod.name)}</span><span>${currency(p.amount)}</span></div>`)
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(branchNameAr)} — فاتورة رقم ${displayNumber}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .center { text-align: center; }
  .brand { font-family: Georgia, "Times New Roman", serif; font-size: 30px; letter-spacing: 2px; color: #a9863f; margin: 0 0 10px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 13px; margin: 0 0 2px; }
  hr { border: none; border-top: 1px dashed #cbd5e1; margin: 14px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: start; color: #64748b; font-weight: 500; font-size: 12px; padding-bottom: 6px; }
  td { padding: 6px 0; vertical-align: top; border-top: 1px solid #f1f5f9; }
  td.num, th.num { text-align: end; white-space: nowrap; }
  .item-name { font-weight: 600; }
  /* SKU codes are Latin letters/digits/dashes — forced LTR so they don't
     visually reorder (e.g. "DRS-EVG-M-BLK" reading backwards) when embedded
     in the page's RTL paragraph context. */
  .item-meta { color: #94a3b8; font-size: 11px; direction: ltr; text-align: start; }
  .row { display: flex; justify-content: space-between; font-size: 14px; padding: 3px 0; }
  .row.total { font-weight: 700; font-size: 16px; border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 8px; }
  .row.discount { color: #16a34a; }
  .meta { font-size: 13px; color: #475569; margin: 2px 0; }
  .qr-wrap { text-align: center; margin-top: 16px; }
  .qr-wrap img { width: 140px; height: 140px; }
  .download-btn { display: block; text-align: center; margin-top: 16px; padding: 10px 16px; border-radius: 8px; background: #a9863f; color: #fff; font-size: 14px; font-weight: 600; text-decoration: none; }
  .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px; }
  /* The button only makes sense in the live browser view -- Puppeteer
     renders this same HTML with print styles when generating the PDF
     itself, so the button must not appear inside the downloaded file. */
  @media print { .download-btn { display: none; } }
</style>
</head>
<body>
  <div class="card">
    <div class="center">
      <div class="brand">Shalky</div>
      <h1>${escapeHtml(branchNameAr)}</h1>
      ${order.branch.address ? `<p class="sub">${escapeHtml(order.branch.address)}</p>` : ""}
      ${order.branch.vatNumber ? `<p class="sub">الرقم الضريبي: ${escapeHtml(order.branch.vatNumber)}</p>` : ""}
      <p class="sub">السجل التجاري: <span dir="ltr">${CR_NUMBER}</span></p>
      <p class="sub">الرقم الموحد: <span dir="ltr">${SAUDI_BUSINESS_NUMBER}</span></p>
    </div>
    <hr />
    <p class="meta">رقم الطلب <span dir="ltr">${escapeHtml(displayNumber)}</span> &middot; ${order.createdAt.toLocaleString("ar-SA")}</p>
    ${order.cashierUser ? `<p class="meta">الكاشير: ${escapeHtml(order.cashierUser.fullName)}</p>` : ""}
    ${order.soldByEmployee ? `<p class="meta">البائع: ${escapeHtml(order.soldByEmployee.fullName)}</p>` : ""}
    ${order.customer ? `<p class="meta">العميل: ${escapeHtml(order.customer.fullName)}${order.customer.phone ? ` (${escapeHtml(order.customer.phone)})` : ""}</p>` : ""}
    <hr />
    <table>
      <thead>
        <tr>
          <th>الصنف</th>
          <th class="num">الكمية</th>
          <th class="num">السعر</th>
          <th class="num">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr />
    <div>
      <div class="row"><span>المجموع الفرعي</span><span>${currency(order.subtotal)}</span></div>
      ${order.discountTotal > 0 ? `<div class="row discount"><span>الخصم</span><span>-${currency(order.discountTotal)}</span></div>` : ""}
      <div class="row"><span>الضريبة</span><span>${currency(order.taxTotal)}</span></div>
      <div class="row total"><span>الإجمالي</span><span>${currency(order.total)}</span></div>
    </div>
    <hr />
    <div>${paymentRows}</div>
    <div class="qr-wrap"><img src="${order.zatcaQrDataUrl}" alt="ZATCA QR" /></div>
    <a class="download-btn" href="/invoices/${order.id}/pdf">تحميل الفاتورة (PDF)</a>
    <div class="footer">شكراً لزيارتكم</div>
  </div>
</body>
</html>`;
}
