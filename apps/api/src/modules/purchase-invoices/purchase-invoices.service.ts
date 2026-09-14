import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { postJournalEntry, resolveAccountIdByCode } from "../../common/accounting/journal-ledger";
import { newId } from "../../common/utils/uuid";
import type { CreatePurchaseInvoiceDto, PurchaseInvoiceListQueryDto, UpdatePurchaseInvoiceDto } from "./purchase-invoices.dto";

const WITH_DETAILS = {
  vendor: true,
  purchaseOrder: true,
  payments: { include: { paymentMethod: true } },
} as const;

@Injectable()
export class PurchaseInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PurchaseInvoiceListQueryDto) {
    const where = {
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [data, totalCount] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({
        where,
        include: WITH_DETAILS,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.purchaseInvoice.count({ where }),
    ]);
    return { data, totalCount };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.purchaseInvoice.findUnique({ where: { id }, include: WITH_DETAILS });
    if (!invoice) throw new NotFoundException("Purchase invoice not found");
    return invoice;
  }

  /**
   * NOTE: this method did not previously run inside a $transaction — the
   * Finance module adds one here since the invoice row and its GL posting
   * must be atomic together.
   */
  async create(dto: CreatePurchaseInvoiceDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException("Vendor not found");

    let branchId: string | undefined;
    if (dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId } });
      if (!po) throw new NotFoundException("Purchase order not found");
      branchId = po.branchId;
    }

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseInvoice.create({
        data: {
          id,
          vendorId: dto.vendorId,
          purchaseOrderId: dto.purchaseOrderId,
          invoiceNumber: dto.invoiceNumber,
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          subtotal: dto.subtotal,
          taxTotal: dto.taxTotal,
          total: dto.total,
          notes: dto.notes,
        },
      });

      // GL posting: PO-linked invoices are a best-effort PO-level match
      // against the Goods Receipt's GRNI posting (Dr 2050 GRNI), not exact
      // GR-line clearing — no DB link exists between GoodsReceipt and
      // PurchaseInvoice, so residual GRNI balance from price/qty variance
      // is normal and reviewed periodically, not auto-reconciled. On-account
      // / lump-sum invoices (no purchaseOrderId) never touched GRNI in the
      // first place, so they hit 1100 Inventory directly instead.
      const [vatReceivableAccountId, apAccountId, netAmountAccountId] = await Promise.all([
        resolveAccountIdByCode(tx, "1200"),
        resolveAccountIdByCode(tx, "2000"),
        resolveAccountIdByCode(tx, dto.purchaseOrderId ? "2050" : "1100"),
      ]);

      const lines: Array<{ accountId: string; debit?: number; credit?: number; description?: string }> = [
        { accountId: netAmountAccountId, debit: dto.subtotal, description: dto.purchaseOrderId ? "Clear GRNI" : "Inventory (lump-sum invoice)" },
      ];
      if (dto.taxTotal > 0) {
        lines.push({ accountId: vatReceivableAccountId, debit: dto.taxTotal, description: "VAT receivable" });
      }
      lines.push({ accountId: apAccountId, credit: dto.total, description: "Accounts payable" });

      await postJournalEntry(tx, {
        entryDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
        description: `Purchase invoice ${dto.invoiceNumber}`,
        sourceType: "PURCHASE_INVOICE",
        sourceId: id,
        branchId,
        lines,
      });
    });
    return this.findOne(id);
  }

  async update(id: string, dto: UpdatePurchaseInvoiceDto) {
    await this.findOne(id);
    const { invoiceDate, dueDate, ...rest } = dto;
    await this.prisma.purchaseInvoice.update({
      where: { id },
      data: {
        ...rest,
        ...(invoiceDate !== undefined ? { invoiceDate: new Date(invoiceDate) } : {}),
        ...(dueDate !== undefined ? { dueDate: new Date(dueDate) } : {}),
      },
    });
    return this.findOne(id);
  }

  async cancel(id: string) {
    const invoice = await this.findOne(id);
    if (invoice.status === "CANCELLED") throw new ConflictException("Invoice is already cancelled");
    if (invoice.payments.length > 0) throw new ConflictException("Cannot cancel an invoice with recorded payments");

    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseInvoice.update({ where: { id }, data: { status: "CANCELLED" } });

      const originalEntry = await tx.journalEntry.findFirst({
        where: { sourceType: "PURCHASE_INVOICE", sourceId: id },
        include: { lines: true },
      });
      if (originalEntry) {
        await postJournalEntry(tx, {
          entryDate: new Date(),
          description: `Cancellation of purchase invoice ${invoice.invoiceNumber}`,
          sourceType: "PURCHASE_INVOICE_CANCEL",
          sourceId: id,
          branchId: originalEntry.branchId ?? undefined,
          reversalOfEntryId: originalEntry.id,
          lines: originalEntry.lines.map((line) => ({
            accountId: line.accountId,
            debit: Number(line.credit),
            credit: Number(line.debit),
          })),
        });
      }
    });

    return this.findOne(id);
  }
}
