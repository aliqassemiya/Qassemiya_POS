import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PdfRendererService } from "../../common/pdf/pdf-renderer.service";
import { buildInvoiceHtml, type InvoiceOrder } from "./invoice-template";
import { buildZatcaQrDataUrl } from "./zatca-qr";

// The legal name this VAT registration is issued under -- used only inside
// the ZATCA QR payload, never shown as visible text on the invoice itself
// (the invoice displays the Shalky brand/branch name instead, by request).
const ZATCA_SELLER_NAME_AR = "مؤسسة نجمه القاسميه للتجارة";

const WITH_INVOICE_DETAILS = {
  branch: true,
  cashierUser: { select: { fullName: true } },
  soldByEmployee: { select: { fullName: true } },
  customer: { select: { fullName: true, phone: true } },
  items: { include: { productVariant: { include: { product: true } } } },
  payments: { include: { paymentMethod: true } },
} as const;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfRenderer: PdfRendererService,
  ) {}

  private async getInvoiceOrder(orderId: string): Promise<InvoiceOrder> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: WITH_INVOICE_DETAILS });
    if (!order) throw new NotFoundException("Order not found");

    const zatcaQrDataUrl = await buildZatcaQrDataUrl({
      sellerName: ZATCA_SELLER_NAME_AR,
      vatNumber: order.branch.vatNumber ?? "",
      timestamp: order.createdAt,
      invoiceTotal: Number(order.total),
      vatTotal: Number(order.taxTotal),
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      subtotal: Number(order.subtotal),
      discountTotal: Number(order.discountTotal),
      taxTotal: Number(order.taxTotal),
      total: Number(order.total),
      status: order.status,
      branch: {
        name: order.branch.name,
        nameAr: order.branch.nameAr,
        address: order.branch.address,
        vatNumber: order.branch.vatNumber,
      },
      cashierUser: order.cashierUser,
      soldByEmployee: order.soldByEmployee,
      customer: order.customer,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
        productVariant: {
          sku: item.productVariant.sku,
          size: item.productVariant.size,
          color: item.productVariant.color,
          product: { name: item.productVariant.product.name },
        },
      })),
      payments: order.payments.map((p) => ({ amount: Number(p.amount), paymentMethod: { name: p.paymentMethod.name } })),
      zatcaQrDataUrl,
    };
  }

  async renderInvoiceHtml(orderId: string): Promise<string> {
    const invoiceOrder = await this.getInvoiceOrder(orderId);
    return buildInvoiceHtml(invoiceOrder);
  }

  /** Renders the same invoice content as a PDF, for the page's "Download PDF" button. */
  async renderInvoicePdf(orderId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const invoiceOrder = await this.getInvoiceOrder(orderId);
    const html = buildInvoiceHtml(invoiceOrder);
    const buffer = await this.pdfRenderer.renderHtmlToPdf(html, { emulatePrint: true });
    return { buffer, fileName: `invoice-${invoiceOrder.orderNumber ?? invoiceOrder.id.slice(0, 8)}.pdf` };
  }
}
