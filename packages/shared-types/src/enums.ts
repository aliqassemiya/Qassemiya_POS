export const BarcodeType = {
  EAN13: "EAN13",
  CODE128: "CODE128",
  UPC_A: "UPC_A",
  QR: "QR",
} as const;
export type BarcodeType = (typeof BarcodeType)[keyof typeof BarcodeType];

export const StockMovementType = {
  INITIAL_STOCK: "INITIAL_STOCK",
  PURCHASE_RECEIVE: "PURCHASE_RECEIVE",
  SALE: "SALE",
  RETURN: "RETURN",
  ADJUSTMENT: "ADJUSTMENT",
  TRANSFER_IN: "TRANSFER_IN",
  TRANSFER_OUT: "TRANSFER_OUT",
  PURCHASE_RETURN: "PURCHASE_RETURN",
} as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const OrderStatus = {
  COMPLETED: "COMPLETED",
  VOIDED: "VOIDED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderSource = {
  POS: "POS",
  ADMIN: "ADMIN",
  ONLINE: "ONLINE",
} as const;
export type OrderSource = (typeof OrderSource)[keyof typeof OrderSource];

export const PaymentStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const ReturnStatus = {
  COMPLETED: "COMPLETED",
  PENDING: "PENDING",
} as const;
export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];

export const PurchaseOrderStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;
export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const PurchaseInvoiceStatus = {
  PENDING: "PENDING",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type PurchaseInvoiceStatus = (typeof PurchaseInvoiceStatus)[keyof typeof PurchaseInvoiceStatus];

export const AccountType = {
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
  EQUITY: "EQUITY",
  REVENUE: "REVENUE",
  EXPENSE: "EXPENSE",
  COGS: "COGS",
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const NormalBalance = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;
export type NormalBalance = (typeof NormalBalance)[keyof typeof NormalBalance];

export const RoleName = {
  SUPER_ADMIN: "SUPER_ADMIN",
  BRANCH_MANAGER: "BRANCH_MANAGER",
  CASHIER: "CASHIER",
  INVENTORY_CLERK: "INVENTORY_CLERK",
} as const;
export type RoleName = (typeof RoleName)[keyof typeof RoleName];

export const PaymentMethodCode = {
  CASH: "CASH",
  CARD: "CARD",
  TABBY: "TABBY",
  TAMARA: "TAMARA",
  GIFT_CARD: "GIFT_CARD",
  STORE_CREDIT: "STORE_CREDIT",
} as const;
export type PaymentMethodCode = (typeof PaymentMethodCode)[keyof typeof PaymentMethodCode];

export const SyncBundleStatus = {
  ACCEPTED: "ACCEPTED",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  ERROR: "ERROR",
} as const;
export type SyncBundleStatus = (typeof SyncBundleStatus)[keyof typeof SyncBundleStatus];

export const PERMISSIONS = [
  "users.manage",
  "branches.manage",
  "employees.manage",
  "customers.manage",
  "catalog.manage",
  "inventory.view",
  "inventory.adjust",
  "pos.sale.create",
  "pos.sale.void",
  "pos.return.create",
  "reports.view",
  "vendors.manage",
  "purchases.po.manage",
  "purchases.receive",
  "purchases.invoice.manage",
  "purchases.payment.create",
  "purchases.return.create",
  "accounts.manage",
  "journal.manage",
  "expenses.manage",
  "reports.financial.view",
  "integrations.shopify.manage",
  "reports.channel.view",
  "integrations.whatsapp.manage",
  "integrations.tamara.manage",
  "pos.payment.confirm",
  "integrations.tabby.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
