export interface CartLineInput {
  unitPrice: number;
  quantity: number;
  discountAmount: number;
  taxRate: number; // percent, e.g. 15
}

export interface CartLineComputed {
  taxAmount: number;
  lineTotal: number;
}

/** Tax-exclusive line calculation: tax is computed on (unitPrice*qty - discount). */
export function computeLine(input: CartLineInput): CartLineComputed {
  const gross = input.unitPrice * input.quantity - input.discountAmount;
  const base = Math.max(gross, 0);
  const taxAmount = round2((base * input.taxRate) / 100);
  const lineTotal = round2(base + taxAmount);
  return { taxAmount, lineTotal };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
