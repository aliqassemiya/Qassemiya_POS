// Renders an Arabic-only, mobile-friendly "online order return" slip page,
// mirroring invoice-template.ts's branding/layout exactly -- this exists
// mainly so the slip can be viewed/downloaded from the dashboard when no
// physical thermal printer is attached (the POS till otherwise prints the
// same content via printer-bridge.ts's printReturnSlip). No pricing/refund
// total is shown -- by design this return never carries a refund amount
// (see ShopifyReturnsService's own comment: the refund happens in Shopify).

import { SHALKY_LOGO_DATA_URI } from "../../common/branding/logo";

const CR_NUMBER = "1010135385";
const SAUDI_BUSINESS_NUMBER = "0000070465";
const RETURN_WHATSAPP_NUMBER = "920031956";

export interface ShopifyReturnSlip {
  id: string;
  shopifyOrderNumber: string;
  createdAt: Date;
  branchName: string;
  branchNameAr: string | null;
  processedByName: string;
  customerName: string | null;
  customerPhone: string | null;
  reason: string | null;
  items: Array<{ title: string; sku: string | null; quantity: number }>;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function buildShopifyReturnSlipHtml(slip: ShopifyReturnSlip): string {
  const branchNameAr = slip.branchNameAr ?? slip.branchName;
  const itemRows = slip.items
    .map(
      (item) => `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(item.title)}</div>
            ${item.sku ? `<div class="item-meta">${escapeHtml(item.sku)}</div>` : ""}
          </td>
          <td class="num">${item.quantity}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(branchNameAr)} — إيصال إرجاع طلب أونلاين ${escapeHtml(slip.shopifyOrderNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font-family: -apple-system, "Segoe UI", "Noto Sans Arabic", Tahoma, Arial, sans-serif; background: #f8fafc; color: #0f172a; }
  .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .center { text-align: center; }
  .brand-logo { height: 40px; margin: 0 0 10px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .tag { display: inline-block; background: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; margin: 0 0 8px; }
  .sub { color: #64748b; font-size: 13px; margin: 0 0 2px; }
  hr { border: none; border-top: 1px dashed #cbd5e1; margin: 14px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: start; color: #64748b; font-weight: 500; font-size: 12px; padding-bottom: 6px; }
  td { padding: 6px 0; vertical-align: top; border-top: 1px solid #f1f5f9; }
  td.num, th.num { text-align: end; white-space: nowrap; }
  .item-name { font-weight: 600; }
  /* text-align: right (not "start") so this stays anchored under the item
     name regardless of how wide this table's (only 2-column, unlike the
     invoice's 4-column) item cell is -- direction: ltr is only there to
     keep the SKU's own digits/hyphens in correct left-to-right order. */
  .item-meta { color: #94a3b8; font-size: 11px; direction: ltr; text-align: right; }
  .meta { font-size: 13px; color: #475569; margin: 2px 0; }
  .reason-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-top: 12px; }
  .whatsapp-box { background: #a9863f; color: #fff; border-radius: 8px; padding: 14px; text-align: center; font-size: 14px; font-weight: 600; line-height: 1.5; margin-top: 16px; }
  .whatsapp-box .number { direction: ltr; display: inline-block; }
  .download-btn { display: block; text-align: center; margin-top: 16px; padding: 10px 16px; border-radius: 8px; background: #0f172a; color: #fff; font-size: 14px; font-weight: 600; text-decoration: none; }
  .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 16px; }
  @media print { .download-btn { display: none; } }
</style>
</head>
<body>
  <div class="card">
    <div class="center">
      <img class="brand-logo" src="${SHALKY_LOGO_DATA_URI}" alt="Shalky" />
      <!-- own block/line, not inline next to the logo -- two adjacent
           inline elements in an RTL context get bidi-reordered as ONE
           group (first-in-markup ends up rightmost) instead of each being
           centered independently, which visibly shifted both off-center. -->
      <div><span class="tag">إرجاع طلب أونلاين</span></div>
      <h1>${escapeHtml(branchNameAr)}</h1>
      <p class="sub">السجل التجاري: <span dir="ltr">${CR_NUMBER}</span></p>
      <p class="sub">الرقم الموحد: <span dir="ltr">${SAUDI_BUSINESS_NUMBER}</span></p>
    </div>
    <hr />
    <p class="meta">رقم الطلب الأونلاين <span dir="ltr">${escapeHtml(slip.shopifyOrderNumber)}</span> &middot; ${slip.createdAt.toLocaleString("ar-SA")}</p>
    <p class="meta">الموظف: ${escapeHtml(slip.processedByName)}</p>
    ${slip.customerName ? `<p class="meta">العميل: ${escapeHtml(slip.customerName)}${slip.customerPhone ? ` (<span dir="ltr">${escapeHtml(slip.customerPhone)}</span>)` : ""}</p>` : ""}
    <hr />
    <table>
      <thead>
        <tr>
          <th>الصنف</th>
          <th class="num">الكمية المرتجعة</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    ${slip.reason ? `<div class="reason-box">السبب: ${escapeHtml(slip.reason)}</div>` : ""}
    <div class="whatsapp-box">
      يرجى مشاركة هذا الإيصال عبر واتساب على الرقم<br />
      <span class="number">${RETURN_WHATSAPP_NUMBER}</span><br />
      لاستلام المبلغ المسترد
    </div>
    <a class="download-btn" href="/shopify-returns/${slip.id}/slip/pdf">تحميل الإيصال (PDF)</a>
    <div class="footer">شكراً لزيارتكم</div>
  </div>
</body>
</html>`;
}
