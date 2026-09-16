/**
 * IPC channel names + request/response shapes shared between main (handlers),
 * preload (contextBridge surface) and renderer (call-site types). Keeping this
 * in one file is what lets `window.api` stay a narrow, explicit, typed surface
 * instead of exposing raw ipcRenderer to the renderer.
 */

export const IpcChannels = {
  GET_PAIRING_STATE: "auth:get-pairing-state",
  LIST_PUBLIC_BRANCHES: "auth:list-public-branches",
  PAIR_DEVICE: "auth:pair-device",
  UNPAIR_DEVICE: "auth:unpair-device",
  PIN_LOGIN: "auth:pin-login",
  LOGOUT: "auth:logout",
  GET_SESSION: "auth:get-session",

  SEARCH_VARIANTS: "catalog:search-variants",
  LOOKUP_BARCODE: "catalog:lookup-barcode",
  LIST_PAYMENT_METHODS: "catalog:list-payment-methods",
  LIST_EMPLOYEES: "catalog:list-employees",
  SEARCH_CUSTOMERS: "catalog:search-customers",
  CREATE_CUSTOMER: "catalog:create-customer",

  CHECKOUT: "sales:checkout",
  LIST_ORDERS: "sales:list-orders",
  GET_ORDER: "sales:get-order",
  CREATE_RETURN: "sales:create-return",

  TAMARA_CREATE_SESSION: "tamara:create-session",
  TABBY_CREATE_SESSION: "tabby:create-session",

  PRINT_RECEIPT: "printer:print-receipt",
  OPEN_CASH_DRAWER: "printer:open-cash-drawer",
  GET_PRINTER_SETTINGS: "printer:get-settings",
  SET_PRINTER_SETTINGS: "printer:set-settings",

  GET_LANGUAGE: "settings:get-language",
  SET_LANGUAGE: "settings:set-language",

  GET_SYNC_STATUS: "sync:get-status",
  FORCE_SYNC: "sync:force-sync",
  ON_SYNC_STATUS_CHANGED: "sync:status-changed",
} as const;

export interface CreateCustomerRequest {
  fullName: string;
  /** Required — matches the phone-mandatory/email-optional rule enforced everywhere a customer is created (POS and admin web alike). */
  phone: string;
  email?: string;
}

export interface PairDeviceRequest {
  apiUrl: string;
  branchId: string;
  deviceName: string;
}

export interface PinLoginRequest {
  employeeCode: string;
  pinCode: string;
}

export interface CheckoutRequest {
  // Set only when a Tamara payment line already reserved this id up front
  // (see TamaraCreateSessionRequest) -- omitted for every other checkout.
  id?: string;
  branchId: string;
  cashierUserId: string;
  soldByEmployeeId?: string | null;
  customerId?: string | null;
  customerName?: string;
  items: Array<{
    productVariantId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxAmount: number;
    lineTotal: number;
    costPriceSnapshot: number;
  }>;
  payments: Array<{
    paymentMethodId: string;
    methodName: string;
    amount: number;
    referenceNumber?: string;
    status?: string;
  }>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
}

export interface TamaraCreateSessionRequest {
  // Reserved order id (uuidv7, generated in the renderer) -- sent to Tamara
  // as order_reference_id, then reused as the real Order.id if checkout
  // completes, so staff have one consistent id across both systems.
  orderReferenceId: string;
  branchId: string;
  amount: number;
  phoneNumber: string;
  items: Array<{
    referenceId: string;
    name: string;
    sku: string;
    quantity: number;
    totalAmount: number;
  }>;
}

export interface TamaraCreateSessionResult {
  checkoutId: string;
  tamaraOrderId: string;
  checkoutDeeplink: string;
}

export interface TabbyCreateSessionRequest {
  // Same reserved-order-id convention as Tamara's request.
  orderReferenceId: string;
  branchId: string;
  amount: number;
  phoneNumber: string;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface TabbyCreateSessionResult {
  sessionId: string;
  paymentId: string;
}

export interface CreateReturnRequest {
  orderId: string;
  branchId: string;
  processedByUserId: string;
  refundPaymentMethodId: string;
  reason?: string;
  items: Array<{
    orderItemId: string;
    productVariantId: string;
    quantity: number;
    refundAmount: number;
    restocked: boolean;
  }>;
  totalRefundAmount: number;
}

export interface PrinterSettings {
  interfaceTarget: string;
}

/** Supported UI languages — persisted in LocalMeta and applied to i18next + `dir`/`lang` on boot. */
export type AppLanguage = "en" | "ar";

export interface SyncStatusPayload {
  online: boolean;
  unsyncedCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}
