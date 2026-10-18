import path from "node:path";
import { app } from "electron";
import { printer as ThermalPrinter, types as PrinterTypes } from "node-thermal-printer";
import bwipjs from "bwip-js/node";
import { getMeta, LocalMetaKey } from "../db/local-meta";

type PrinterInstance = InstanceType<typeof ThermalPrinter>;

export interface ReceiptItem {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReceiptPayment {
  methodName: string;
  amount: number;
}

export interface ReceiptData {
  branchName: string;
  orderId: string;
  cashierName: string;
  createdAt: string;
  customerName?: string;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  payments: ReceiptPayment[];
}

export interface PrintResult {
  ok: boolean;
  error?: string;
  /** Where output was written — useful in dev when no physical printer is attached. */
  target?: string;
}

/**
 * Resolves the configured printer target from LocalMeta. Falls back to a plain
 * file path under userData ("dummy" interface) so printing never throws when
 * unconfigured — this is what lets checkout be exercised in dev without hardware:
 * node-thermal-printer writes raw ESC/POS bytes to a file when the `interface`
 * string isn't a `tcp://` or `printer:` target.
 */
async function getPrinterInterface(): Promise<string> {
  const stored = await getMeta(LocalMetaKey.PRINTER_TARGET);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { interface?: string };
      if (parsed.interface) return parsed.interface;
    } catch {
      return stored; // stored as a raw interface string
    }
  }
  return path.join(app.getPath("userData"), "last-receipt.bin");
}

async function buildPrinter(): Promise<{ printer: PrinterInstance; target: string }> {
  const target = await getPrinterInterface();
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: target,
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });
  return { printer, target };
}

function money(n: number): string {
  return n.toFixed(2);
}

export async function printReceipt(data: ReceiptData): Promise<PrintResult> {
  try {
    const { printer, target } = await buildPrinter();

    printer.alignCenter();
    printer.bold(true);
    printer.setTextDoubleHeight();
    printer.println(data.branchName || "Qassemiya");
    printer.setTextNormal();
    printer.bold(false);
    printer.println(new Date(data.createdAt).toLocaleString());
    printer.println(`Order: ${data.orderId.slice(0, 8)}`);
    printer.println(`Cashier: ${data.cashierName}`);
    if (data.customerName) printer.println(`Customer: ${data.customerName}`);
    printer.drawLine();

    printer.alignLeft();
    for (const item of data.items) {
      printer.println(`${item.name} (${item.sku})`);
      printer.tableCustom([
        { text: `${item.quantity} x ${money(item.unitPrice)}`, align: "LEFT", width: 0.6 },
        { text: money(item.lineTotal), align: "RIGHT", width: 0.4 },
      ]);
    }
    printer.drawLine();

    printer.tableCustom([
      { text: "Subtotal", align: "LEFT", width: 0.6 },
      { text: money(data.subtotal), align: "RIGHT", width: 0.4 },
    ]);
    if (data.discountTotal > 0) {
      printer.tableCustom([
        { text: "Discount", align: "LEFT", width: 0.6 },
        { text: `-${money(data.discountTotal)}`, align: "RIGHT", width: 0.4 },
      ]);
    }
    printer.tableCustom([
      { text: "Tax", align: "LEFT", width: 0.6 },
      { text: money(data.taxTotal), align: "RIGHT", width: 0.4 },
    ]);
    printer.bold(true);
    printer.tableCustom([
      { text: "TOTAL", align: "LEFT", width: 0.6 },
      { text: money(data.total), align: "RIGHT", width: 0.4 },
    ]);
    printer.bold(false);
    printer.drawLine();

    for (const payment of data.payments) {
      printer.tableCustom([
        { text: payment.methodName, align: "LEFT", width: 0.6 },
        { text: money(payment.amount), align: "RIGHT", width: 0.4 },
      ]);
    }
    printer.newLine();

    // Barcode/QR of the order id, generated via bwip-js and embedded as a raster image.
    try {
      const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: data.orderId,
        scale: 2,
        height: 10,
        includetext: true,
        textxalign: "center",
      });
      printer.alignCenter();
      const printImageBuffer = (printer as unknown as { printImageBuffer?: (buf: Buffer) => void })
        .printImageBuffer;
      if (typeof printImageBuffer === "function") {
        printImageBuffer.call(printer, png);
      }
    } catch (barcodeErr) {
      // Non-fatal: receipt text still prints even if barcode rendering fails.
      // eslint-disable-next-line no-console
      console.warn("[printer] barcode render failed", barcodeErr);
    }

    printer.alignCenter();
    printer.println("Thank you for shopping with us");
    printer.cut();

    await printer.execute();
    return { ok: true, target };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface ReturnSlipItem {
  name: string;
  sku: string;
  quantity: number;
}

export interface ReturnSlipData {
  branchName: string;
  returnId: string;
  shopifyOrderNumber: string;
  cashierName: string;
  createdAt: string;
  customerName?: string;
  items: ReturnSlipItem[];
  reason?: string;
}

// The refund itself happens in Shopify, not at the till (see
// shopify-returns-service.ts) -- this slip is the customer's only proof the
// return was taken, and the only instruction for how to actually get their
// money back, so that WhatsApp line is load-bearing, not decoration.
export async function printReturnSlip(data: ReturnSlipData): Promise<PrintResult> {
  try {
    const { printer, target } = await buildPrinter();

    printer.alignCenter();
    printer.bold(true);
    printer.setTextDoubleHeight();
    printer.println(data.branchName || "Qassemiya");
    printer.setTextNormal();
    printer.bold(false);
    printer.println("ONLINE ORDER RETURN");
    printer.println(new Date(data.createdAt).toLocaleString());
    printer.println(`Online order: ${data.shopifyOrderNumber}`);
    printer.println(`Cashier: ${data.cashierName}`);
    if (data.customerName) printer.println(`Customer: ${data.customerName}`);
    printer.drawLine();

    printer.alignLeft();
    for (const item of data.items) {
      printer.println(`${item.name} (${item.sku})`);
      printer.println(`  Qty returned: ${item.quantity}`);
    }
    printer.drawLine();

    if (data.reason) {
      printer.println(`Reason: ${data.reason}`);
      printer.drawLine();
    }

    try {
      const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: data.returnId,
        scale: 2,
        height: 10,
        includetext: true,
        textxalign: "center",
      });
      printer.alignCenter();
      const printImageBuffer = (printer as unknown as { printImageBuffer?: (buf: Buffer) => void })
        .printImageBuffer;
      if (typeof printImageBuffer === "function") {
        printImageBuffer.call(printer, png);
      }
    } catch (barcodeErr) {
      // eslint-disable-next-line no-console
      console.warn("[printer] return slip barcode render failed", barcodeErr);
    }

    printer.newLine();
    printer.alignCenter();
    printer.bold(true);
    printer.println("Please share this slip via WhatsApp");
    printer.println("at 920031956 to receive your refund.");
    printer.bold(false);
    printer.cut();

    await printer.execute();
    return { ok: true, target };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function openCashDrawer(): Promise<PrintResult> {
  try {
    const { printer, target } = await buildPrinter();
    printer.openCashDrawer();
    await printer.execute();
    return { ok: true, target };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Label (ZPL) printer driver interface — stub only, per plan scope. Not implemented
 * in this pass; wire up a real ZPL/network or USB implementation when label printing
 * becomes a requirement.
 */
export interface LabelPrinterDriver {
  printBarcodeLabel(input: { sku: string; barcode: string; name: string; price: number }): Promise<PrintResult>;
}

export class ZplLabelPrinterDriver implements LabelPrinterDriver {
  async printBarcodeLabel(): Promise<PrintResult> {
    return { ok: false, error: "Label printing (ZPL) is not implemented in this pass." };
  }
}
