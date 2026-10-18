import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels, type AppLanguage, type CheckoutRequest, type CreateCustomerRequest, type CreateReturnRequest, type CreateShopifyReturnRequest, type PairDeviceRequest, type PinLoginRequest, type SyncStatusPayload, type TamaraCreateSessionRequest, type TabbyCreateSessionRequest } from "../shared/ipc";

/**
 * Narrow, explicit bridge — the renderer only ever sees these named methods,
 * never raw ipcRenderer/Node. Every method here maps 1:1 to an ipcMain.handle
 * in src/main/ipc/register.ts.
 */
const api = {
  auth: {
    getPairingState: () => ipcRenderer.invoke(IpcChannels.GET_PAIRING_STATE),
    listPublicBranches: (apiUrl: string) => ipcRenderer.invoke(IpcChannels.LIST_PUBLIC_BRANCHES, apiUrl),
    pairDevice: (req: PairDeviceRequest) => ipcRenderer.invoke(IpcChannels.PAIR_DEVICE, req),
    unpairDevice: () => ipcRenderer.invoke(IpcChannels.UNPAIR_DEVICE),
    pinLogin: (req: PinLoginRequest) => ipcRenderer.invoke(IpcChannels.PIN_LOGIN, req),
    logout: () => ipcRenderer.invoke(IpcChannels.LOGOUT),
    getSession: () => ipcRenderer.invoke(IpcChannels.GET_SESSION),
  },
  catalog: {
    searchVariants: (query: string) => ipcRenderer.invoke(IpcChannels.SEARCH_VARIANTS, query),
    lookupBarcode: (barcode: string) => ipcRenderer.invoke(IpcChannels.LOOKUP_BARCODE, barcode),
    listPaymentMethods: () => ipcRenderer.invoke(IpcChannels.LIST_PAYMENT_METHODS),
    listEmployees: () => ipcRenderer.invoke(IpcChannels.LIST_EMPLOYEES),
    searchCustomers: (query: string) => ipcRenderer.invoke(IpcChannels.SEARCH_CUSTOMERS, query),
    createCustomer: (req: CreateCustomerRequest) => ipcRenderer.invoke(IpcChannels.CREATE_CUSTOMER, req),
  },
  tamara: {
    createCheckoutSession: (req: TamaraCreateSessionRequest) => ipcRenderer.invoke(IpcChannels.TAMARA_CREATE_SESSION, req),
  },
  tabby: {
    createCheckoutSession: (req: TabbyCreateSessionRequest) => ipcRenderer.invoke(IpcChannels.TABBY_CREATE_SESSION, req),
  },
  sales: {
    checkout: (req: CheckoutRequest) => ipcRenderer.invoke(IpcChannels.CHECKOUT, req),
    listOrders: (branchId: string) => ipcRenderer.invoke(IpcChannels.LIST_ORDERS, branchId),
    searchServerOrders: (query: string) => ipcRenderer.invoke(IpcChannels.SEARCH_SERVER_ORDERS, query),
    getOrder: (orderId: string) => ipcRenderer.invoke(IpcChannels.GET_ORDER, orderId),
    createReturn: (req: CreateReturnRequest) => ipcRenderer.invoke(IpcChannels.CREATE_RETURN, req),
    searchLocalShopifyOrders: (query: string) => ipcRenderer.invoke(IpcChannels.SEARCH_LOCAL_SHOPIFY_ORDERS, query),
    getShopifyOrder: (id: string) => ipcRenderer.invoke(IpcChannels.GET_SHOPIFY_ORDER, id),
    createShopifyReturn: (req: CreateShopifyReturnRequest) => ipcRenderer.invoke(IpcChannels.CREATE_SHOPIFY_RETURN, req),
  },
  printer: {
    printReceipt: (receipt: unknown) => ipcRenderer.invoke(IpcChannels.PRINT_RECEIPT, receipt),
    openCashDrawer: () => ipcRenderer.invoke(IpcChannels.OPEN_CASH_DRAWER),
    getSettings: () => ipcRenderer.invoke(IpcChannels.GET_PRINTER_SETTINGS),
    setSettings: (settings: { interfaceTarget: string }) => ipcRenderer.invoke(IpcChannels.SET_PRINTER_SETTINGS, settings),
  },
  settings: {
    getLanguage: (): Promise<AppLanguage> => ipcRenderer.invoke(IpcChannels.GET_LANGUAGE),
    setLanguage: (language: AppLanguage) => ipcRenderer.invoke(IpcChannels.SET_LANGUAGE, language),
  },
  sync: {
    getStatus: () => ipcRenderer.invoke(IpcChannels.GET_SYNC_STATUS),
    forceSync: () => ipcRenderer.invoke(IpcChannels.FORCE_SYNC),
    onStatusChanged: (callback: (status: SyncStatusPayload) => void) => {
      const listener = (_e: Electron.IpcRendererEvent, status: SyncStatusPayload): void => callback(status);
      ipcRenderer.on(IpcChannels.ON_SYNC_STATUS_CHANGED, listener);
      return () => {
        ipcRenderer.removeListener(IpcChannels.ON_SYNC_STATUS_CHANGED, listener);
      };
    },
  },
};

export type Api = typeof api;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("api", api);
} else {
  throw new Error("contextIsolation must be enabled — refusing to expose a raw API surface");
}
