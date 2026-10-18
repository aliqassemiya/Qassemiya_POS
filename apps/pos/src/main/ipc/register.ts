import { ipcMain, type BrowserWindow } from "electron";
import { IpcChannels, type AppLanguage, type CheckoutRequest, type CreateCustomerRequest, type CreateReturnRequest, type CreateShopifyReturnRequest, type PairDeviceRequest, type PinLoginRequest, type TamaraCreateSessionRequest, type TabbyCreateSessionRequest } from "../../shared/ipc";
import { pairDevice, getPairingState, pinLogin, logout, getCurrentSession, listPublicBranches, unpairDevice } from "../services/auth-service";
import { searchVariants, lookupByBarcode, listPaymentMethods, listEmployees, searchCustomers, createCustomer } from "../services/catalog-service";
import { createSale, listRecentOrders, getOrderWithItems, createReturn, searchServerOrders } from "../services/sales-service";
import { searchLocalShopifyOrders, getLocalShopifyOrderWithItems, createShopifyReturn } from "../services/shopify-returns-service";
import { createTamaraCheckoutSession } from "../services/tamara-service";
import { createTabbyCheckoutSession } from "../services/tabby-service";
import { printReceipt, printReturnSlip, openCashDrawer, type ReceiptData } from "../printer/printer-bridge";
import { getMeta, setMeta, LocalMetaKey } from "../db/local-meta";
import { syncWorker } from "../sync/sync-worker";

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IpcChannels.GET_PAIRING_STATE, () => getPairingState());

  ipcMain.handle(IpcChannels.LIST_PUBLIC_BRANCHES, (_e, apiUrl: string) => listPublicBranches(apiUrl));

  ipcMain.handle(IpcChannels.PAIR_DEVICE, (_e, req: PairDeviceRequest) => pairDevice(req));

  ipcMain.handle(IpcChannels.UNPAIR_DEVICE, () => unpairDevice());

  ipcMain.handle(IpcChannels.PIN_LOGIN, (_e, req: PinLoginRequest) => pinLogin(req));

  ipcMain.handle(IpcChannels.LOGOUT, () => logout());

  ipcMain.handle(IpcChannels.GET_SESSION, () => getCurrentSession());

  ipcMain.handle(IpcChannels.SEARCH_VARIANTS, async (_e, query: string) => {
    const branchId = await getMeta(LocalMetaKey.BRANCH_ID);
    return searchVariants(query, branchId);
  });

  ipcMain.handle(IpcChannels.LOOKUP_BARCODE, async (_e, barcode: string) => {
    const branchId = await getMeta(LocalMetaKey.BRANCH_ID);
    return lookupByBarcode(barcode, branchId);
  });

  ipcMain.handle(IpcChannels.LIST_PAYMENT_METHODS, () => listPaymentMethods());

  ipcMain.handle(IpcChannels.LIST_EMPLOYEES, () => listEmployees());

  ipcMain.handle(IpcChannels.SEARCH_CUSTOMERS, (_e, query: string) => searchCustomers(query));

  ipcMain.handle(IpcChannels.CREATE_CUSTOMER, (_e, req: CreateCustomerRequest) => createCustomer(req));

  ipcMain.handle(IpcChannels.TAMARA_CREATE_SESSION, (_e, req: TamaraCreateSessionRequest) => createTamaraCheckoutSession(req));

  ipcMain.handle(IpcChannels.TABBY_CREATE_SESSION, (_e, req: TabbyCreateSessionRequest) => createTabbyCheckoutSession(req));

  ipcMain.handle(IpcChannels.CHECKOUT, async (_e, req: CheckoutRequest) => {
    const result = await createSale(req);

    const branchName = (await getMeta(LocalMetaKey.BRANCH_NAME)) ?? "Qassemiya";
    const cashierName = (await getMeta(LocalMetaKey.CURRENT_EMPLOYEE_NAME)) ?? "Cashier";
    const receipt: ReceiptData = {
      branchName,
      orderId: result.orderId,
      cashierName,
      createdAt: result.createdAt,
      customerName: req.customerName,
      items: req.items.map((i) => ({ name: i.name, sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice, lineTotal: i.lineTotal })),
      subtotal: req.subtotal,
      discountTotal: req.discountTotal,
      taxTotal: req.taxTotal,
      total: req.total,
      payments: req.payments.map((p) => ({ methodName: p.methodName, amount: p.amount })),
    };
    // Print immediately, but never let a printer failure roll back or block the completed sale.
    const printResult = await printReceipt(receipt).catch((err) => ({ ok: false, error: String(err) }));

    return { ...result, print: printResult };
  });

  ipcMain.handle(IpcChannels.LIST_ORDERS, async (_e, branchId: string) => listRecentOrders(branchId));

  ipcMain.handle(IpcChannels.SEARCH_SERVER_ORDERS, async (_e, query: string) => searchServerOrders(query));

  ipcMain.handle(IpcChannels.GET_ORDER, async (_e, orderId: string) => getOrderWithItems(orderId));

  ipcMain.handle(IpcChannels.CREATE_RETURN, async (_e, req: CreateReturnRequest) => {
    const result = await createReturn(req);
    return result;
  });

  ipcMain.handle(IpcChannels.SEARCH_LOCAL_SHOPIFY_ORDERS, async (_e, query: string) => searchLocalShopifyOrders(query));

  ipcMain.handle(IpcChannels.GET_SHOPIFY_ORDER, async (_e, id: string) => getLocalShopifyOrderWithItems(id));

  ipcMain.handle(IpcChannels.CREATE_SHOPIFY_RETURN, async (_e, req: CreateShopifyReturnRequest) => {
    const result = await createShopifyReturn(req);

    const branchName = (await getMeta(LocalMetaKey.BRANCH_NAME)) ?? "Qassemiya";
    const cashierName = (await getMeta(LocalMetaKey.CURRENT_EMPLOYEE_NAME)) ?? "Cashier";
    // Print immediately, online or offline -- the customer needs the slip
    // regardless of whether the till can reach the server yet, and a printer
    // failure must never block or roll back the already-saved return record.
    const printResult = await printReturnSlip({
      branchName,
      returnId: result.returnId,
      shopifyOrderNumber: req.shopifyOrderNumber,
      cashierName,
      createdAt: result.createdAt,
      customerName: req.customerName,
      items: req.items.map((i) => ({ name: i.name, sku: i.sku, quantity: i.quantity })),
      reason: req.reason,
    }).catch((err) => ({ ok: false, error: String(err) }));

    return { ...result, print: printResult };
  });

  ipcMain.handle(IpcChannels.PRINT_RECEIPT, (_e, receipt: ReceiptData) => printReceipt(receipt));

  ipcMain.handle(IpcChannels.OPEN_CASH_DRAWER, () => openCashDrawer());

  ipcMain.handle(IpcChannels.GET_PRINTER_SETTINGS, async () => ({
    interfaceTarget: (await getMeta(LocalMetaKey.PRINTER_TARGET)) ?? "",
  }));

  ipcMain.handle(IpcChannels.SET_PRINTER_SETTINGS, async (_e, settings: { interfaceTarget: string }) => {
    await setMeta(LocalMetaKey.PRINTER_TARGET, settings.interfaceTarget || null);
    return { ok: true };
  });

  ipcMain.handle(IpcChannels.GET_LANGUAGE, async () => ((await getMeta(LocalMetaKey.LANGUAGE)) as AppLanguage | null) ?? "en");

  ipcMain.handle(IpcChannels.SET_LANGUAGE, async (_e, language: AppLanguage) => {
    await setMeta(LocalMetaKey.LANGUAGE, language);
    return { ok: true };
  });

  ipcMain.handle(IpcChannels.GET_SYNC_STATUS, () => syncWorker.getStatus());

  ipcMain.handle(IpcChannels.FORCE_SYNC, async () => {
    await syncWorker.pushPending();
    await syncWorker.pullCatalog();
    return syncWorker.getStatus();
  });

  syncWorker.onStatusChange((status) => {
    // `?.` only guards null/undefined — a closed-then-reopened window (or an
    // HMR reload in dev) can leave `mainWindow` pointing at a non-null but
    // destroyed BrowserWindow, and .webContents.send() throws synchronously
    // on that. isDestroyed() is the real guard.
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IpcChannels.ON_SYNC_STATUS_CHANGED, status);
    }
  });
}
