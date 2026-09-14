/**
 * Normalizes a Saudi phone number into the plain-digit E.164-without-"+"
 * shape WhatsApp's Graph API expects for its `to` field (e.g. "966556889898").
 *
 * Real `Customer.phone` data in this system is inconsistent — sampled from
 * the live database and found five shapes in actual use: "+966XXXXXXXXX",
 * "966XXXXXXXXX" (no +), "00966XXXXXXXXX", "0XXXXXXXXX" (10-digit local),
 * and bare "5XXXXXXXX"/"XXXXXXXXX" (9-digit, country code omitted). This
 * recognizes all five and never guesses beyond them — anything else returns
 * null so the caller can log it as skipped instead of sending to a
 * fabricated number.
 */
export function normalizeSaudiPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");

  if (digits.startsWith("00966") && digits.length === 14) {
    return digits.slice(2);
  }
  if (digits.startsWith("966") && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `966${digits.slice(1)}`;
  }
  if (digits.length === 9 && digits.startsWith("5")) {
    return `966${digits}`;
  }

  return null;
}
