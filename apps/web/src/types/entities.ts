/**
 * Response-shape types for entities returned by the API.
 *
 * `@qassemiya/shared-types` only exports zod schemas for *request bodies*
 * (login input, product input, stock-adjust input, etc.) — there are no
 * response/entity schemas defined yet. These interfaces are our best-effort
 * mirror of the Prisma models described in the approved plan
 * (User/Role/Branch/Product/ProductVariant/Inventory/StockMovement/
 * Order/OrderItem/Payment/Return/ReturnItem/Customer/Employee) so the UI has
 * something concrete to code against. If the real API response shapes differ
 * once apps/api lands, only this file (plus the thin api/*.ts wrappers)
 * should need updating — pages and components consume these types, not raw
 * API responses.
 */
import type {
  BarcodeType,
  OrderSource,
  OrderStatus,
  Permission,
  PaymentMethodCode,
  PaymentStatus,
  ReturnStatus,
  RoleName,
  StockMovementType,
} from "@qassemiya/shared-types";

export interface AuthUserRole {
  role: RoleName;
  branchId: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: AuthUserRole[];
  permissions: Permission[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  address?: string | null;
  phone?: string | null;
  vatNumber?: string | null;
  isActive: boolean;
  isWarehouse: boolean;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode?: string | null;
  barcodeType: BarcodeType;
  size?: string | null;
  color?: string | null;
  colorHex?: string | null;
  costPrice: number;
  sellingPrice: number;
  compareAtPrice?: number | null;
  taxRate: number;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  brand?: string | null;
  // One image per product/style, not per-variant — these are dresses.
  imageUrl?: string | null;
  // "Primary vendor" tag — product-level (not per-variant), per Part A of the
  // plan. Not yet in @qassemiya/shared-types' productSchema (that lands with
  // the parallel apps/api build), so the product form sends it out-of-band —
  // see ProductFormPage.tsx.
  vendorId?: string | null;
  vendor?: Pick<Vendor, "id" | "code" | "name"> | null;
  variants: ProductVariant[];
  createdAt: string;
}

export interface Inventory {
  id: string;
  branchId: string;
  branch?: Branch;
  productVariantId: string;
  variant?: ProductVariant & { product?: Pick<Product, "id" | "name"> };
  quantityOnHand: number;
}

export interface StockMovement {
  id: string;
  branchId: string;
  productVariantId: string;
  variant?: ProductVariant & { product?: Pick<Product, "id" | "name"> };
  type: StockMovementType;
  quantityChange: number;
  note?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  code: PaymentMethodCode;
  name: string;
  isActive: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  variant?: ProductVariant & { product?: Pick<Product, "id" | "name"> };
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  costPriceSnapshot: number;
}

export interface Payment {
  id: string;
  orderId: string;
  paymentMethodId: string;
  paymentMethod?: PaymentMethod;
  amount: number;
  referenceNumber?: string | null;
  status: PaymentStatus;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber?: string | null;
  branchId: string;
  branch?: Branch;
  cashierUserId: string;
  soldByEmployeeId?: string | null;
  soldByEmployee?: Pick<Employee, "id" | "employeeCode" | "fullName"> | null;
  customerId?: string | null;
  customer?: Customer | null;
  source: OrderSource;
  status: OrderStatus;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  notes?: string | null;
  items: OrderItem[];
  payments: Payment[];
  createdAt: string;
}

export interface Return {
  id: string;
  orderId: string;
  branchId: string;
  processedByUserId: string;
  reason?: string | null;
  status: ReturnStatus;
  totalRefundAmount: number;
  items: ReturnItemRecord[];
  createdAt: string;
  order?: { orderNumber: string | null } | null;
}

export interface ReturnItemRecord {
  id: string;
  returnId: string;
  orderItemId: string;
  quantity: number;
  refundAmount: number;
  restocked: boolean;
}

// No refundAmount/restocked/status -- unlike Return above, an online-order
// return never touches inventory or the GL (the refund happens in Shopify).
export interface ShopifyReturn {
  id: string;
  shopifyOrderId: string;
  branchId: string;
  processedByUserId: string;
  reason?: string | null;
  createdAt: string;
  items: ShopifyReturnItemRecord[];
  shopifyOrder?: { orderNumber: string } | null;
}

export interface ShopifyReturnItemRecord {
  id: string;
  shopifyReturnId: string;
  shopifyOrderItemId: string;
  quantity: number;
  shopifyOrderItem?: { title: string; sku: string | null; quantity: number } | null;
}

export interface Customer {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Employee {
  id: string;
  userId?: string | null;
  employeeCode: string;
  fullName: string;
  email?: string | null;
  branchId: string;
  branch?: Branch;
  roles: RoleName[];
  isActive: boolean;
  createdAt: string;
}

export interface Role {
  id: string;
  name: RoleName;
  description?: string | null;
}

export interface UserRoleGrant {
  id: string;
  roleId: string;
  branchId: string | null;
  role: Role;
  branch: Branch | null;
}

/** A dashboard-login account (email + password) -- distinct from Employee's POS PIN login. */
export interface DashboardUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userRoles: UserRoleGrant[];
}

export interface SalesSummaryReport {
  branchId?: string | null;
  from: string;
  to: string;
  orderCount: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  byPaymentMethod: { paymentMethodId: string; name: string; amount: number }[];
}

/**
 * Vendor & Purchasing Management (Part A of the approved plan).
 *
 * `@qassemiya/shared-types` does not yet export `packages/shared-types/src/purchasing.ts`
 * (a separate agent is building the apps/api modules + that shared-types file
 * in parallel) — so, exactly like the original phase-1 build against
 * apps/api before it existed, these interfaces and the accompanying local
 * zod schemas in the purchasing pages/api wrappers are our best-effort
 * mirror of the field names/endpoints documented in the plan. Once the real
 * shared-types schemas land, only this file plus the thin api/*.ts wrappers
 * and the local form schemas should need reconciling.
 */

// Mirrors the PurchaseOrderStatus enum described in the plan (also to be
// added to shared-types' enums.ts by the parallel apps/api build).
export const PurchaseOrderStatus = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;
export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

// Mirrors the PurchaseInvoiceStatus enum described in the plan.
export const PurchaseInvoiceStatus = {
  PENDING: "PENDING",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
} as const;
export type PurchaseInvoiceStatus = (typeof PurchaseInvoiceStatus)[keyof typeof PurchaseInvoiceStatus];

export interface Vendor {
  id: string;
  code: string;
  numericCode: number;
  name: string;
  nameAr?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  vatNumber?: string | null;
  paymentTermsDays?: number | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
}

/** One row of `GET /vendors/:id/statement` — a chronological AP ledger entry. */
export interface VendorStatementEntry {
  type: "INVOICE" | "PAYMENT" | "RETURN";
  date: string;
  referenceId: string;
  referenceLabel?: string | null;
  /** Increases the amount owed to the vendor (invoices). */
  debit: number;
  /** Decreases the amount owed to the vendor (payments, return credits). */
  credit: number;
  runningBalance: number;
}

export interface VendorStatement {
  vendor: Vendor;
  entries: VendorStatementEntry[];
  balance: number;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productVariantId: string;
  variant?: ProductVariant & { product?: Pick<Product, "id" | "name"> };
  quantityOrdered: number;
  // Materialized running counter, atomically incremented by goods-receipts —
  // never read-then-write, per the plan (same pattern as Inventory.quantityOnHand).
  quantityReceived: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  branchId: string;
  branch?: Branch;
  status: PurchaseOrderStatus;
  notes?: string | null;
  items: PurchaseOrderItem[];
  createdByUserId?: string | null;
  createdAt: string;
}

export interface GoodsReceiptItem {
  id: string;
  goodsReceiptId: string;
  purchaseOrderItemId: string;
  productVariantId: string;
  variant?: ProductVariant & { product?: Pick<Product, "id" | "name"> };
  quantityReceived: number;
  // Received unit cost can differ from the PO's quoted cost — feeds the
  // last-cost update to ProductVariant.costPrice, per the plan.
  unitCost: number;
}

export interface GoodsReceipt {
  id: string;
  purchaseOrderId: string;
  purchaseOrder?: PurchaseOrder;
  branchId: string;
  deliveryNoteRef?: string | null;
  receivedByUserId?: string | null;
  items: GoodsReceiptItem[];
  createdAt: string;
}

export interface PurchaseInvoice {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  purchaseOrderId?: string | null;
  purchaseOrder?: Pick<PurchaseOrder, "id" | "status"> | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  status: PurchaseInvoiceStatus;
  notes?: string | null;
  createdAt: string;
}

export interface VendorPayment {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  purchaseInvoiceId?: string | null;
  amount: number;
  paymentMethodId: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string | null;
  paidAt: string;
  createdAt: string;
}

export interface PurchaseReturnItem {
  id: string;
  purchaseReturnId: string;
  purchaseOrderItemId: string;
  productVariantId: string;
  variant?: ProductVariant & { product?: Pick<Product, "id" | "name"> };
  quantity: number;
  creditAmount: number;
}

export interface PurchaseReturn {
  id: string;
  purchaseOrderId: string;
  purchaseOrder?: Pick<PurchaseOrder, "id" | "vendorId">;
  branchId: string;
  processedByUserId: string;
  reason?: string | null;
  status: ReturnStatus;
  totalCreditAmount: number;
  items: PurchaseReturnItem[];
  createdAt: string;
}

export interface VendorPerformanceRow {
  vendorId: string;
  vendorName: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface VendorPerformanceProductRow {
  vendorId: string;
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface VendorPerformanceReport {
  from?: string | null;
  to?: string | null;
  byVendor: VendorPerformanceRow[];
  byProduct: VendorPerformanceProductRow[];
}

export interface VendorBalanceRow {
  vendorId: string;
  vendorName: string;
  totalInvoiced: number;
  totalPaid: number;
  totalReturnCredits: number;
  outstanding: number;
}

/**
 * Finance & Accounting (chart of accounts / journal entries / expenses).
 *
 * `@qassemiya/shared-types` does not yet export `packages/shared-types/src/accounting.ts`
 * (a separate agent is building the apps/api `accounts`/`journal-entries`/`expenses`
 * modules + that shared-types file in parallel) — so, exactly like the
 * Vendor & Purchasing types above, these interfaces and the local
 * AccountType/NormalBalance unions are our best-effort mirror of the field
 * names/endpoints documented in the approved plan
 * (spicy-kindling-puffin.md). Once the real shared-types schemas/enums land,
 * only this file plus the thin api/*.ts wrappers and local form schemas
 * should need reconciling.
 */

// Mirrors the Account.type enum described in the plan (also to be added to
// shared-types' enums.ts by the parallel apps/api build).
export const AccountType = {
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
  EQUITY: "EQUITY",
  REVENUE: "REVENUE",
  EXPENSE: "EXPENSE",
  COGS: "COGS",
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

// Mirrors the Account.normalBalance enum described in the plan — stored
// explicitly per-account (not derived from `type`), since contra accounts
// like "4100 Sales Returns & Allowances" (type REVENUE, debit-normal) break
// any type->balance derivation.
export const NormalBalance = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT",
} as const;
export type NormalBalance = (typeof NormalBalance)[keyof typeof NormalBalance];

export interface Account {
  id: string;
  code: string;
  name: string;
  nameAr?: string | null;
  type: AccountType;
  normalBalance: NormalBalance;
  parentId?: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  account?: Pick<Account, "id" | "code" | "name">;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface JournalEntry {
  id: string;
  entryDate: string;
  description: string;
  // Free string mirroring StockMovement.referenceType's forward-compat
  // rationale — e.g. "SALE", "RETURN", "PURCHASE_INVOICE", "VENDOR_PAYMENT",
  // "MANUAL", etc. Manual entries created from the web UI always send "MANUAL".
  sourceType: string;
  sourceId?: string | null;
  branchId?: string | null;
  branch?: Pick<Branch, "id" | "name"> | null;
  createdByUserId?: string | null;
  reversalOfEntryId?: string | null;
  lines: JournalLine[];
  createdAt: string;
}

export interface Expense {
  id: string;
  branchId?: string | null;
  branch?: Pick<Branch, "id" | "name"> | null;
  categoryAccountId: string;
  categoryAccount?: Pick<Account, "id" | "name">;
  amount: number;
  paidByMethodId: string;
  paidByMethod?: PaymentMethod;
  expenseDate: string;
  description?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
}

/**
 * One row of `GET /accounts/:id/ledger` — a chronological JournalLine entry
 * with running balance. Verified against the live API response (not a
 * guess): `{account, entries: [{journalEntryId, date, description,
 * sourceType, sourceId, debit, credit, balance}], closingBalance}` — no
 * `journalLineId` field, top-level is `closingBalance` not `balance`, entry
 * running-balance field is `balance` not `runningBalance`.
 */
export interface AccountLedgerEntry {
  journalEntryId: string;
  date: string;
  description: string;
  sourceType: string;
  sourceId?: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export interface AccountLedger {
  account: Account;
  entries: AccountLedgerEntry[];
  closingBalance: number;
}

/** `GET /reports/trial-balance` — verified against the live API response. */
export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debit: number;
  credit: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

/**
 * `GET /reports/profit-and-loss` — verified against the live API response.
 * revenue/cogs/expenses are each `{accounts: [...], total}`, not flat
 * numbers; the bottom line field is `netProfit`, not `netIncome`.
 */
export interface ProfitAndLossAccountLine {
  accountId: string;
  code: string;
  name: string;
  amount: number;
}
export interface ProfitAndLossReport {
  revenue: { accounts: ProfitAndLossAccountLine[]; total: number };
  cogs: { accounts: ProfitAndLossAccountLine[]; total: number };
  grossProfit: number;
  expenses: { accounts: ProfitAndLossAccountLine[]; total: number };
  netProfit: number;
}

/**
 * `GET /reports/balance-sheet` — verified against the live API response.
 * Row field is `amount`, not `balance`; there is no top-level
 * `retainedEarnings` field or `branchId` field — Retained Earnings appears
 * only as one row inside `equity`.
 */
export interface BalanceSheetAccountLine {
  accountId: string;
  code: string;
  name: string;
  amount: number;
}
export interface BalanceSheetReport {
  asOf: string | null;
  assets: BalanceSheetAccountLine[];
  liabilities: BalanceSheetAccountLine[];
  equity: BalanceSheetAccountLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  balanced: boolean;
}

/**
 * `GET /reports/cash-flow` — a simple Cash Position, not a full statement.
 * Verified against the live API response: per-account array key is
 * `accounts`, not `byAccount`.
 */
export interface CashPositionAccountLine {
  accountId: string;
  code: string;
  name: string;
  opening: number;
  movement: number;
  closing: number;
}
export interface CashPositionReport {
  accounts: CashPositionAccountLine[];
  opening: number;
  movement: number;
  closing: number;
}

/**
 * `GET /reports/vat-summary` — verified against the live API response.
 * Shape is `{vatPayable: {collected,reversed,net}, vatReceivable:
 * {paid,reversed,net}, netVatDue}`, not the flat {outputVat,inputVat,
 * netPosition} originally guessed.
 */
export interface VatSummaryReport {
  vatPayable: { collected: number; reversed: number; net: number };
  vatReceivable: { paid: number; reversed: number; net: number };
  netVatDue: number;
}
