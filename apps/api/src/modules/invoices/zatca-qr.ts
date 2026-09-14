// ZATCA Phase 1 (Generation phase) QR code: a Base64-encoded TLV (Tag-Length-
// Value) blob covering the 5 fields ZATCA requires on a simplified tax
// invoice's QR code. No ZATCA account, CSID, or API call needed for this --
// that's only required for Phase 2 (Integration phase), which additionally
// signs the invoice and adds a cryptographic stamp + hash to the QR. This
// Phase 1 payload is a strict subset of Phase 2's, so nothing here is wasted
// work if/when this business is notified to move to Phase 2.
import QRCode from "qrcode";

function tlv(tag: number, value: string): Buffer {
  const valueBuf = Buffer.from(value, "utf8");
  if (valueBuf.length > 255) throw new Error(`ZATCA QR field (tag ${tag}) exceeds 255 bytes`);
  return Buffer.concat([Buffer.from([tag, valueBuf.length]), valueBuf]);
}

export interface ZatcaQrFields {
  sellerName: string;
  vatNumber: string;
  timestamp: Date;
  invoiceTotal: number;
  vatTotal: number;
}

export function buildZatcaQrPayloadBase64(fields: ZatcaQrFields): string {
  const buf = Buffer.concat([
    tlv(1, fields.sellerName),
    tlv(2, fields.vatNumber),
    tlv(3, fields.timestamp.toISOString()),
    tlv(4, fields.invoiceTotal.toFixed(2)),
    tlv(5, fields.vatTotal.toFixed(2)),
  ]);
  return buf.toString("base64");
}

/** Returns a self-contained "data:image/png;base64,..." string, embeddable directly in an <img src>. */
export async function buildZatcaQrDataUrl(fields: ZatcaQrFields): Promise<string> {
  const payload = buildZatcaQrPayloadBase64(fields);
  return QRCode.toDataURL(payload, { width: 180, margin: 1 });
}
