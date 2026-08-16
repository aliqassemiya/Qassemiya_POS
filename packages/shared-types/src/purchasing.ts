import { z } from "zod";

// All purchasing resources are admin-only and never created offline by POS,
// so — unlike sales.ts — none of these schemas take a client-supplied `id`;
// every id is server-generated via newId() in the service layer.

export const vendorSchema = z.object({
  code: z.string().min(1),
  numericCode: z.number().int().positive(),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
  paymentTermsDays: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});
export type VendorInput = z.infer<typeof vendorSchema>;

export const purchaseOrderItemSchema = z.object({
  productVariantId: z.string().uuid(),
  quantityOrdered: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().default(0),
  lineTotal: z.number().nonnegative(),
});
export type PurchaseOrderItemInput = z.infer<typeof purchaseOrderItemSchema>;

export const createPurchaseOrderSchema = z.object({
  vendorId: z.string().uuid(),
  branchId: z.string().uuid(),
  expectedDate: z.string().datetime().optional(),
  items: z.array(purchaseOrderItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  discountTotal: z.number().nonnegative().default(0),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  notes: z.string().optional(),
});
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

export const updatePurchaseOrderSchema = z.object({
  expectedDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>;

export const goodsReceiptItemSchema = z.object({
  purchaseOrderItemId: z.string().uuid(),
  productVariantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
});
export type GoodsReceiptItemInput = z.infer<typeof goodsReceiptItemSchema>;

export const createGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  branchId: z.string().uuid(),
  deliveryNoteRef: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(goodsReceiptItemSchema).min(1),
});
export type CreateGoodsReceiptInput = z.infer<typeof createGoodsReceiptSchema>;

export const createPurchaseInvoiceSchema = z.object({
  vendorId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional(),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  subtotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  notes: z.string().optional(),
});
export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>;

export const updatePurchaseInvoiceSchema = createPurchaseInvoiceSchema.partial();
export type UpdatePurchaseInvoiceInput = z.infer<typeof updatePurchaseInvoiceSchema>;

export const createVendorPaymentSchema = z.object({
  vendorId: z.string().uuid(),
  purchaseInvoiceId: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid(),
  amount: z.number().positive(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().datetime().optional(),
});
export type CreateVendorPaymentInput = z.infer<typeof createVendorPaymentSchema>;

export const purchaseReturnItemSchema = z.object({
  purchaseOrderItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  creditAmount: z.number().nonnegative(),
});
export type PurchaseReturnItemInput = z.infer<typeof purchaseReturnItemSchema>;

export const createPurchaseReturnSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  branchId: z.string().uuid(),
  reason: z.string().optional(),
  items: z.array(purchaseReturnItemSchema).min(1),
  totalCreditAmount: z.number().nonnegative(),
});
export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;
