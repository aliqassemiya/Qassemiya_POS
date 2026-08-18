/**
 * Store's standard size → 2-digit SKU-suffix code chart (letter sizes,
 * numeric sizes, and combo sizes like "M/L" all get a fixed code). Used by
 * the product form's size-based variant generator: base SKU + code = full
 * variant SKU (e.g. base "1612345" + size "36" (code "36") = "161234536").
 */
export interface SizeCodeEntry {
  label: string;
  code: string;
}

export const SIZE_CODES: SizeCodeEntry[] = [
  { label: "XS", code: "01" },
  { label: "S", code: "02" },
  { label: "M", code: "03" },
  { label: "L", code: "04" },
  { label: "XL", code: "05" },
  { label: "XXL", code: "06" },
  { label: "26", code: "26" },
  { label: "28", code: "28" },
  { label: "30", code: "30" },
  { label: "31", code: "31" },
  { label: "32", code: "32" },
  { label: "39", code: "39" },
  { label: "41", code: "41" },
  { label: "33", code: "33" },
  { label: "M/L", code: "55" },
  { label: "XL/XXL", code: "57" },
  { label: "34", code: "34" },
  { label: "36", code: "36" },
  { label: "37", code: "37" },
  { label: "38", code: "38" },
  { label: "40", code: "40" },
  { label: "42", code: "42" },
  { label: "44", code: "44" },
  { label: "46", code: "46" },
  { label: "48", code: "48" },
  { label: "50", code: "50" },
  { label: "52", code: "52" },
  { label: "S/M", code: "53" },
  { label: "L/XL", code: "54" },
  { label: "XXXL", code: "56" },
];
