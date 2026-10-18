/**
 * Response shape for GET /sync/catalog. Not defined in @qassemiya/shared-types
 * (only syncCatalogQuerySchema — the request query — is specified there), so this
 * is a local, POS-only assumption about the payload shape kept intentionally
 * close to the catalog.ts creation schemas (productSchema/productVariantSchema/
 * categorySchema) plus server-assigned id/updatedAt. Adjust here if the API's
 * actual response shape differs once apps/api is finalized.
 */

export interface CatalogCategoryRow {
  id: string;
  name: string;
  nameAr?: string | null;
  parentId?: string | null;
  updatedAt: string;
}

export interface CatalogProductRow {
  id: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  categoryId?: string | null;
  brand?: string | null;
  // One image per product/style, not per-variant — these are dresses.
  imageUrl?: string | null;
  updatedAt: string;
}

export interface CatalogVariantRow {
  id: string;
  productId: string;
  sku: string;
  barcode?: string | null;
  barcodeType?: string | null;
  size?: string | null;
  color?: string | null;
  colorHex?: string | null;
  costPrice: number;
  sellingPrice: number;
  compareAtPrice?: number | null;
  taxRate: number;
  updatedAt: string;
}

export interface CatalogInventoryRow {
  id: string;
  branchId: string;
  productVariantId: string;
  quantityOnHand: number;
  updatedAt: string;
}

export interface CatalogCustomerRow {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  updatedAt: string;
}

export interface CatalogPaymentMethodRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
}

export interface CatalogEmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
  branchId: string;
  updatedAt: string;
}

export interface CatalogShopifyOrderRow {
  id: string;
  orderNumber: string;
  shopifyCreatedAt: string;
  currentTotalPrice: number;
  currency: string;
  customerName?: string | null;
  customerPhone?: string | null;
  updatedAt: string;
}

export interface CatalogShopifyOrderItemRow {
  id: string;
  shopifyOrderId: string;
  sku?: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productVariantId?: string | null;
}

export interface SyncCatalogResponse {
  serverTime: string;
  categories: CatalogCategoryRow[];
  products: CatalogProductRow[];
  variants: CatalogVariantRow[];
  inventory: CatalogInventoryRow[];
  customers: CatalogCustomerRow[];
  paymentMethods: CatalogPaymentMethodRow[];
  employees: CatalogEmployeeRow[];
  shopifyOrders: CatalogShopifyOrderRow[];
  shopifyOrderItems: CatalogShopifyOrderItemRow[];
}
