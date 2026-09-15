import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { applyStockMovement } from "../../common/inventory/stock-ledger";
import { postJournalEntry, resolveAccountIdByCode, resolvePaymentAccountId } from "../../common/accounting/journal-ledger";
import { newId } from "../../common/utils/uuid";
import { WhatsappService } from "../whatsapp/whatsapp.service";
import type { CreateSaleInput } from "@qassemiya/shared-types";
import type { CreateSaleDto, SalesListQueryDto, VoidSaleDto } from "./sales.dto";

const WITH_DETAILS = {
  branch: true,
  items: { include: { productVariant: { include: { product: true } } } },
  payments: { include: { paymentMethod: true } },
  customer: true,
  // select, not include:true — an Employee row carries pinCodeHash, which
  // has no business being in a sales API response even when null.
  soldByEmployee: { select: { id: true, employeeCode: true, fullName: true } },
} as const;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
  ) {}

  async findAll(query: SalesListQueryDto) {
    const where = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.cashierUserId ? { cashierUserId: query.cashierUserId } : {}),
      ...(query.soldByEmployeeId ? { soldByEmployeeId: query.soldByEmployeeId } : {}),
      ...(query.paymentMethodId ? { payments: { some: { paymentMethodId: query.paymentMethodId } } } : {}),
      ...(query.from || query.to
        ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { id: { startsWith: query.search, mode: "insensitive" as const } },
              { items: { some: { productVariant: { sku: { contains: query.search, mode: "insensitive" as const } } } } },
            ],
          }
        : {}),
    };

    const [data, totalCount, totalsAgg] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: WITH_DETAILS,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
      // Sums ALL matching orders, not just the current page — the salesperson
      // summary bar needs a true filtered total, not one page's worth.
      this.prisma.order.aggregate({ where, _sum: { total: true } }),
    ]);

    return { data, totalCount, totalAmount: Number(totalsAgg._sum.total ?? 0) };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: WITH_DETAILS });
    if (order) return order;

    // Full order ids are 36-char UUIDs; the printed receipt only shows the
    // first 8 characters (see printer-bridge.ts's `Order: ${id.slice(0,8)}`)
    // — a cashier looking a sale up to process a return only ever has that
    // prefix on hand, so fall back to a prefix match for anything shorter.
    if (id.length < 36) {
      const prefixMatch = await this.prisma.order.findFirst({
        where: { id: { startsWith: id } },
        include: WITH_DETAILS,
      });
      if (prefixMatch) return prefixMatch;
    }

    throw new NotFoundException("Order not found");
  }

  async create(dto: CreateSaleDto) {
    const existing = await this.prisma.order.findUnique({ where: { id: dto.id } });
    if (existing) throw new ConflictException("Order with this id already exists");

    await this.createSaleTx(dto);
    return this.findOne(dto.id);
  }

  /** Shared by the direct REST endpoint and the sync module. Caller must have already checked for id collisions if idempotency matters. */
  async createSaleTx(input: CreateSaleInput, clientCreatedAt?: Date) {
    await this.prisma.$transaction(async (tx) => {
      // Human-friendly sequential invoice number: branch.code + an 8-digit
      // zero-padded per-branch counter (e.g. "20100000020"). Assigned here,
      // at commit time, because it's the one place both the direct REST path
      // and the POS-sync path funnel through — an offline till can't safely
      // self-assign a no-gaps number. The upsert is atomic under concurrent
      // transactions (Postgres compiles it to INSERT ... ON CONFLICT DO
      // UPDATE, which resolves races at the row level).
      const branch = await tx.branch.findUniqueOrThrow({
        where: { id: input.branchId },
        select: { code: true },
      });
      const sequence = await tx.branchOrderSequence.upsert({
        where: { branchId: input.branchId },
        create: { branchId: input.branchId, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const orderNumber = `${branch.code}${String(sequence.lastNumber).padStart(8, "0")}`;

      await tx.order.create({
        data: {
          id: input.id,
          branchId: input.branchId,
          cashierUserId: input.cashierUserId,
          soldByEmployeeId: input.soldByEmployeeId ?? undefined,
          customerId: input.customerId ?? undefined,
          source: input.source,
          orderNumber,
          subtotal: input.subtotal,
          discountTotal: input.discountTotal,
          taxTotal: input.taxTotal,
          total: input.total,
          notes: input.notes,
          clientCreatedAt,
          syncedAt: clientCreatedAt ? new Date() : undefined,
          items: {
            create: input.items.map((item) => ({
              id: item.id,
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount,
              taxAmount: item.taxAmount,
              lineTotal: item.lineTotal,
              costPriceSnapshot: item.costPriceSnapshot,
            })),
          },
          payments: {
            create: input.payments.map((p) => ({
              id: newId(),
              paymentMethodId: p.paymentMethodId,
              amount: p.amount,
              referenceNumber: p.referenceNumber,
              status: p.status,
            })),
          },
        },
      });

      for (const item of input.items) {
        await applyStockMovement(tx, {
          branchId: input.branchId,
          productVariantId: item.productVariantId,
          quantityChange: -item.quantity,
          type: "SALE",
          referenceType: "ORDER",
          referenceId: input.id,
          createdByUserId: input.cashierUserId,
        });
      }

      // GL posting: Dr each payment's mapped account (+ Dr 1050 Accounts
      // Receivable for any shortfall vs order.total) · Cr 4000 Sales Revenue
      // (subtotal - discountTotal) · Cr 2100 VAT Payable (taxTotal) ·
      // Dr 5000 COGS / Cr 1100 Inventory at the *historical* cost snapshot
      // (never current ProductVariant.costPrice, which may have moved since).
      const [salesRevenueAccountId, vatPayableAccountId, cogsAccountId, inventoryAccountId, arAccountId] = await Promise.all([
        resolveAccountIdByCode(tx, "4000"),
        resolveAccountIdByCode(tx, "2100"),
        resolveAccountIdByCode(tx, "5000"),
        resolveAccountIdByCode(tx, "1100"),
        resolveAccountIdByCode(tx, "1050"),
      ]);

      const lines: Array<{ accountId: string; debit?: number; credit?: number; description?: string }> = [];

      let paymentsTotal = 0;
      for (const payment of input.payments) {
        const accountId = await resolvePaymentAccountId(tx, payment.paymentMethodId);
        lines.push({ accountId, debit: payment.amount, description: "Sale payment" });
        paymentsTotal += payment.amount;
      }
      const shortfall = Math.round((input.total - paymentsTotal) * 100) / 100;
      if (shortfall > 0) {
        lines.push({ accountId: arAccountId, debit: shortfall, description: "Sale on account (unpaid shortfall)" });
      }

      lines.push({
        accountId: salesRevenueAccountId,
        credit: Math.round((input.subtotal - input.discountTotal) * 100) / 100,
        description: "Sale revenue",
      });
      if (input.taxTotal > 0) {
        lines.push({ accountId: vatPayableAccountId, credit: input.taxTotal, description: "VAT collected" });
      }

      const cogsTotal = Math.round(input.items.reduce((sum, item) => sum + item.costPriceSnapshot * item.quantity, 0) * 100) / 100;
      if (cogsTotal > 0) {
        lines.push({ accountId: cogsAccountId, debit: cogsTotal, description: "Cost of goods sold" });
        lines.push({ accountId: inventoryAccountId, credit: cogsTotal, description: "Inventory reduction" });
      }

      await postJournalEntry(tx, {
        entryDate: clientCreatedAt ?? new Date(),
        description: `Sale ${input.id}`,
        sourceType: "SALE",
        sourceId: input.id,
        branchId: input.branchId,
        createdByUserId: input.cashierUserId,
        lines,
      });
    });

    // Fire-and-forget, deliberately not awaited — a WhatsApp/network failure
    // must never fail the sale itself or turn a successful POS sync bundle
    // into an error result. sendInvoiceForOrder never throws (it logs every
    // outcome internally), so this .catch() is just a last-resort net.
    this.whatsappService.sendInvoiceForOrder(input.id).catch((err) => {
      this.logger.error(`WhatsApp invoice send failed for order ${input.id}: ${err}`);
    });
  }

  /**
   * Reverses the sale's stock decrement and marks it VOIDED, plus posts a
   * full mirror-reversal of the original SALE journal entry (every line's
   * debit<->credit swapped).
   *
   * DESIGN ASSUMPTION (plan flagged this as needing client confirmation,
   * proceeding with the plan's stated default per instructions rather than
   * blocking): void assumes a same-shift correction where the cash never
   * really left the drawer — i.e. this reverses the sale's revenue/VAT/COGS
   * postings exactly as booked, without a separate cash-out leg. A
   * completed sale that needs money actually refunded to a customer after
   * the fact should go through the separate Return flow instead, which does
   * post a real cash-out against the refund payment method.
   */
  async void(id: string, dto: VoidSaleDto) {
    const order = await this.findOne(id);
    if (order.status === "VOIDED") throw new ConflictException("Order is already voided");

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: { status: "VOIDED", notes: dto.reason ? `${order.notes ?? ""}\nVoided: ${dto.reason}`.trim() : order.notes },
      });
      for (const item of order.items) {
        await applyStockMovement(tx, {
          branchId: order.branchId,
          productVariantId: item.productVariantId,
          quantityChange: item.quantity,
          type: "ADJUSTMENT",
          referenceType: "ORDER_VOID",
          referenceId: id,
          note: dto.reason,
        });
      }

      const originalEntry = await tx.journalEntry.findFirst({
        where: { sourceType: "SALE", sourceId: id },
        include: { lines: true },
      });
      if (originalEntry) {
        await postJournalEntry(tx, {
          entryDate: new Date(),
          description: `Void of sale ${id}${dto.reason ? `: ${dto.reason}` : ""}`,
          sourceType: "SALE_VOID",
          sourceId: id,
          branchId: order.branchId,
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

  /**
   * Manually flips a PENDING payment (Tamara/Tabby, awaiting staff to check
   * the provider's own dashboard) to COMPLETED. No GL re-posting -- the sale
   * already posted its full GL entry at creation time (see createSaleTx);
   * this is a pure bookkeeping flip on the payment row, not a new financial
   * event.
   */
  async confirmPayment(orderId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, orderId } });
    if (!payment) throw new NotFoundException("Payment not found");
    if (payment.status === "COMPLETED") return payment; // idempotent -- re-clicking "confirm" is harmless
    if (payment.status !== "PENDING") {
      throw new ConflictException(`Cannot confirm a payment with status ${payment.status}`);
    }
    return this.prisma.payment.update({ where: { id: paymentId }, data: { status: "COMPLETED" } });
  }
}
