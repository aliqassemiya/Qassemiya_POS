import { create } from "zustand";
import { computeLine } from "../lib/cart-math";

export interface CartItem {
  productVariantId: string;
  sku: string;
  name: string;
  size: string | null;
  color: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
  costPriceSnapshot: number;
}

export interface CartPaymentLine {
  key: string;
  paymentMethodId: string;
  methodName: string;
  amount: number;
  referenceNumber?: string;
}

export interface CartCustomer {
  id: string;
  name: string;
}

export interface CartEmployee {
  id: string;
  fullName: string;
}

interface CartStore {
  items: CartItem[];
  customer: CartCustomer | null;
  soldByEmployee: CartEmployee | null;
  payments: CartPaymentLine[];
  addItem: (item: {
    productVariantId: string;
    sku: string;
    name: string;
    size: string | null;
    color: string | null;
    imageUrl: string | null;
    unitPrice: number;
    taxRate: number;
    costPriceSnapshot: number;
  }) => void;
  setQuantity: (productVariantId: string, quantity: number) => void;
  setDiscount: (productVariantId: string, discountAmount: number) => void;
  removeItem: (productVariantId: string) => void;
  setCustomer: (customer: CartCustomer | null) => void;
  setSoldByEmployee: (employee: CartEmployee | null) => void;
  addPayment: (line: Omit<CartPaymentLine, "key">) => void;
  updatePayment: (key: string, amount: number, referenceNumber?: string) => void;
  removePayment: (key: string) => void;
  clear: () => void;
}

function recompute(item: CartItem): CartItem {
  const { taxAmount, lineTotal } = computeLine({
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    discountAmount: item.discountAmount,
    taxRate: item.taxRate,
  });
  return { ...item, taxAmount, lineTotal };
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  customer: null,
  soldByEmployee: null,
  payments: [],

  addItem: (input) =>
    set((state) => {
      const existing = state.items.find((i) => i.productVariantId === input.productVariantId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productVariantId === input.productVariantId ? recompute({ ...i, quantity: i.quantity + 1 }) : i,
          ),
        };
      }
      const item = recompute({
        productVariantId: input.productVariantId,
        sku: input.sku,
        name: input.name,
        size: input.size,
        color: input.color,
        imageUrl: input.imageUrl,
        quantity: 1,
        unitPrice: input.unitPrice,
        discountAmount: 0,
        taxRate: input.taxRate,
        taxAmount: 0,
        lineTotal: input.unitPrice,
        costPriceSnapshot: input.costPriceSnapshot,
      });
      return { items: [...state.items, item] };
    }),

  setQuantity: (productVariantId, quantity) =>
    set((state) => ({
      items: state.items
        .map((i) => (i.productVariantId === productVariantId ? recompute({ ...i, quantity: Math.max(1, quantity) }) : i))
        .filter((i) => i.quantity > 0),
    })),

  setDiscount: (productVariantId, discountAmount) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.productVariantId === productVariantId ? recompute({ ...i, discountAmount: Math.max(0, discountAmount) }) : i,
      ),
    })),

  removeItem: (productVariantId) =>
    set((state) => ({ items: state.items.filter((i) => i.productVariantId !== productVariantId) })),

  setCustomer: (customer) => set({ customer }),

  setSoldByEmployee: (soldByEmployee) => set({ soldByEmployee }),

  addPayment: (line) =>
    set((state) => ({ payments: [...state.payments, { ...line, key: `${Date.now()}-${Math.random()}` }] })),

  updatePayment: (key, amount, referenceNumber) =>
    set((state) => ({
      payments: state.payments.map((p) => (p.key === key ? { ...p, amount, referenceNumber } : p)),
    })),

  removePayment: (key) => set((state) => ({ payments: state.payments.filter((p) => p.key !== key) })),

  clear: () => set({ items: [], customer: null, soldByEmployee: null, payments: [] }),
}));

export function cartTotals(items: CartItem[]) {
  const subtotal = round2(items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0));
  const discountTotal = round2(items.reduce((sum, i) => sum + i.discountAmount, 0));
  const taxTotal = round2(items.reduce((sum, i) => sum + i.taxAmount, 0));
  const total = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
  return { subtotal, discountTotal, taxTotal, total };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
