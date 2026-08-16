import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { postJournalEntry, resolveAccountIdByCode, resolvePaymentAccountId } from "../../common/accounting/journal-ledger";
import { newId } from "../../common/utils/uuid";
import type { CreateVendorPaymentDto, VendorPaymentListQueryDto } from "./vendor-payments.dto";
import type { Prisma } from "../../../generated/prisma";

const WITH_DETAILS = {
  vendor: true,
  purchaseInvoice: true,
  paymentMethod: true,
} as const;

@Injectable()
export class VendorPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: VendorPaymentListQueryDto) {
    return this.prisma.vendorPayment.findMany({
      where: {
        ...(query.vendorId ? { vendorId: query.vendorId } : {}),
        ...(query.purchaseInvoiceId ? { purchaseInvoiceId: query.purchaseInvoiceId } : {}),
      },
      include: WITH_DETAILS,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.vendorPayment.findUnique({ where: { id }, include: WITH_DETAILS });
    if (!payment) throw new NotFoundException("Vendor payment not found");
    return payment;
  }

  async create(dto: CreateVendorPaymentDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException("Vendor not found");

    if (dto.purchaseInvoiceId) {
      const invoice = await this.prisma.purchaseInvoice.findUnique({ where: { id: dto.purchaseInvoiceId } });
      if (!invoice) throw new NotFoundException("Purchase invoice not found");
      if (invoice.vendorId !== dto.vendorId) throw new ConflictException("Invoice does not belong to this vendor");
    }

    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.vendorPayment.create({
        data: {
          id,
          vendorId: dto.vendorId,
          purchaseInvoiceId: dto.purchaseInvoiceId,
          paymentMethodId: dto.paymentMethodId,
          amount: dto.amount,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        },
      });

      if (dto.purchaseInvoiceId) {
        await this.recomputeInvoiceStatus(tx, dto.purchaseInvoiceId);
      }

      // GL posting: Dr 2000 Accounts Payable / Cr the payment method's mapped account.
      const [apAccountId, paymentAccountId] = await Promise.all([
        resolveAccountIdByCode(tx, "2000"),
        resolvePaymentAccountId(tx, dto.paymentMethodId),
      ]);
      await postJournalEntry(tx, {
        entryDate: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        description: `Vendor payment to ${vendor.name}`,
        sourceType: "VENDOR_PAYMENT",
        sourceId: id,
        lines: [
          { accountId: apAccountId, debit: dto.amount, description: "Accounts payable settled" },
          { accountId: paymentAccountId, credit: dto.amount, description: "Payment out" },
        ],
      });
    });

    return this.findOne(id);
  }

  private async recomputeInvoiceStatus(tx: Prisma.TransactionClient, purchaseInvoiceId: string) {
    const invoice = await tx.purchaseInvoice.findUnique({ where: { id: purchaseInvoiceId } });
    if (!invoice || invoice.status === "CANCELLED") return;

    const payments = await tx.vendorPayment.findMany({ where: { purchaseInvoiceId } });
    const paid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const total = Number(invoice.total);

    const status = paid <= 0 ? "PENDING" : paid >= total ? "PAID" : "PARTIALLY_PAID";
    await tx.purchaseInvoice.update({ where: { id: purchaseInvoiceId }, data: { status } });
  }
}
