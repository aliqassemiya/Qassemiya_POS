/**
 * Kysely table type definitions for the local SQLite database.
 *
 * Naming convention: snake_case columns (idiomatic SQLite), camelCase in
 * application code — Kysely's CamelCasePlugin handles the mapping so callers
 * never see snake_case.
 *
 * Table groups (see plan "Offline Sync (Electron POS)"):
 *  - read-cache tables: product, productVariant, category, inventory, customer, paymentMethod
 *  - write-origin tables: order, orderItem, payment, return, returnItem, stockMovement
 *  - localMeta: key/value settings store (deviceUuid, tokens, branchId, current employee, printer target, ...)
 */

export interface CategoryTable {
  id: string;
  name: string;
  nameAr: string | null;
  parentId: string | null;
  updatedAt: string;
}

export interface ProductTable {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  categoryId: string | null;
  brand: string | null;
  imageUrl: string | null;
  updatedAt: string;
}

export interface ProductVariantTable {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  barcodeType: string | null;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  costPrice: number;
  sellingPrice: number;
  compareAtPrice: number | null;
  taxRate: number;
  updatedAt: string;
}

export interface InventoryTable {
  id: string;
  branchId: string;
  productVariantId: string;
  quantityOnHand: number;
  updatedAt: string;
}

export interface CustomerTable {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  updatedAt: string;
}

export interface PaymentMethodTable {
  id: string;
  code: string;
  name: string;
  isActive: number; // 0 | 1
  updatedAt: string;
}

/** Read-cache, scoped to this device's own branch — see catalog-service.ts. */
export interface EmployeeTable {
  id: string;
  employeeCode: string;
  fullName: string;
  branchId: string;
  updatedAt: string;
}

export interface OrderTable {
  id: string;
  branchId: string;
  cashierUserId: string;
  soldByEmployeeId: string | null;
  customerId: string | null;
  source: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  notes: string | null;
  createdAt: string;
  syncedAt: string | null;
  syncAttempts: number;
  lastSyncError: string | null;
}

export interface OrderItemTable {
  id: string;
  orderId: string;
  productVariantId: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  costPriceSnapshot: number;
}

export interface PaymentTable {
  id: string;
  orderId: string;
  paymentMethodId: string;
  amount: number;
  referenceNumber: string | null;
  status: string;
}

export interface ReturnTable {
  id: string;
  orderId: string;
  branchId: string;
  processedByUserId: string;
  refundPaymentMethodId: string | null;
  reason: string | null;
  totalRefundAmount: number;
  createdAt: string;
  syncedAt: string | null;
  syncAttempts: number;
  lastSyncError: string | null;
}

export interface ReturnItemTable {
  id: string;
  returnId: string;
  orderItemId: string;
  quantity: number;
  refundAmount: number;
  restocked: number; // 0 | 1
}

export interface StockMovementTable {
  id: string;
  branchId: string;
  productVariantId: string;
  quantityChange: number;
  type: string;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export interface LocalMetaTable {
  key: string;
  value: string | null;
}

export interface Database {
  category: CategoryTable;
  product: ProductTable;
  productVariant: ProductVariantTable;
  inventory: InventoryTable;
  customer: CustomerTable;
  paymentMethod: PaymentMethodTable;
  employee: EmployeeTable;
  order: OrderTable;
  orderItem: OrderItemTable;
  payment: PaymentTable;
  return: ReturnTable;
  returnItem: ReturnItemTable;
  stockMovement: StockMovementTable;
  localMeta: LocalMetaTable;
}
