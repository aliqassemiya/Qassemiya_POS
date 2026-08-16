import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { applyStockMovement } from "../../common/inventory/stock-ledger";
import { postJournalEntry, resolveAccountIdByCode, resolvePaymentAccountId } from "../../common/accounting/journal-ledger";
import { newId } from "../../common/utils/uuid";
import type { CreateReturnInput } from "@qassemiya/shared-types";
import type { CreateReturnDto, ReturnsListQueryDto } from "./returns.dto";
import type { Prisma } from "../../../generated/prisma";

const WITH_DETAILS = { items: { include: { orderItem: true } } } as const;

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: ReturnsListQueryDto) {
    return this.prisma.return.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
      },
      include: WITH_DETAILS,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const ret = await this.prisma.return.findUnique({ where: { id }, include: WITH_DETAILS });
    if (!ret) throw new NotFoundException("Return not found");
    return ret;
  }

  async create(dto: CreateReturnDto) {
    const existing = await this.prisma.return.findUnique({ where: { id: dto.id } });
    if (existing) throw new ConflictException("Return with this id already exists");

    const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException("Order not found");

    await this.createReturnTx(dto);
    return this.findOne(dto.id);
  }

  async createReturnTx(input: CreateReturnInput) {
    await this.prisma.$transaction(async (tx) => {
      await tx.return.create({
        data: {
          id: input.id,
          orderId: input.orderId,
          branchId: input.branchId,
          processedByUserId: input.processedByUserId,
          refundPaymentMethodId: input.refundPaymentMethodId,
          reason: input.reason,
          totalRefundAmount: input.totalRefundAmount,
          items: {
            create: input.items.map((item) => ({
              id: newId(),
              orderItemId: item.orderItemId,
              quantity: item.quantity,
              refundAmount: item.refundAmount,
              restocked: item.restocked,
            })),
          },
        },
      });

      // GL posting: prorate each original OrderItem's OWN tax ratio (not the
      // current tax rate, which may have changed since the sale) into a
      // reversed-VAT / reversed-revenue split of the refund amount. Restock
      // (restocked=true) additionally puts the goods back into inventory at
      // the original cost snapshot.
      let reversedVatCents = 0;
      let refundTotalCents = 0;
      let restockCostTotal = 0;

      for (const item of input.items) {
        const orderItem = await tx.orderItem.findUnique({ where: { id: item.orderItemId } });
        if (!orderItem) continue;

        const lineTotalNum = Number(orderItem.lineTotal);
        const taxAmountNum = Number(orderItem.taxAmount);
        const taxRatio = lineTotalNum > 0 ? taxAmountNum / lineTotalNum : 0;
        reversedVatCents += Math.round(item.refundAmount * taxRatio * 100);
        refundTotalCents += Math.round(item.refundAmount * 100);

        if (item.restocked) {
          restockCostTotal += Number(orderItem.costPriceSnapshot) * item.quantity;
          await applyStockMovement(tx, {
            branchId: input.branchId,
            productVariantId: orderItem.productVariantId,
            quantityChange: item.quantity,
            type: "RETURN",
            referenceType: "RETURN",
            referenceId: input.id,
            createdByUserId: input.processedByUserId,
          });
        }
      }

      const reversedVat = reversedVatCents / 100;
      const reversedRevenue = (refundTotalCents - reversedVatCents) / 100;

      const [returnsAllowanceAccountId, vatPayableAccountId, inventoryAccountId, cogsAccountId] = await Promise.all([
        resolveAccountIdByCode(tx, "4100"),
        resolveAccountIdByCode(tx, "2100"),
        resolveAccountIdByCode(tx, "1100"),
        resolveAccountIdByCode(tx, "5000"),
      ]);
      const refundAccountId = await resolvePaymentAccountId(tx, input.refundPaymentMethodId);

      const lines: Array<{ accountId: string; debit?: number; credit?: number; description?: string }> = [];
      if (reversedRevenue > 0) {
        lines.push({ accountId: returnsAllowanceAccountId, debit: reversedRevenue, description: "Sales returns & allowances" });
      }
      if (reversedVat > 0) {
        lines.push({ accountId: vatPayableAccountId, debit: reversedVat, description: "VAT reversed on return" });
      }
      lines.push({ accountId: refundAccountId, credit: refundTotalCents / 100, description: "Refund paid out" });
      if (restockCostTotal > 0) {
        lines.push({ accountId: inventoryAccountId, debit: restockCostTotal, description: "Restocked inventory" });
        lines.push({ accountId: cogsAccountId, credit: restockCostTotal, description: "COGS reversal for restocked items" });
      }

      await postJournalEntry(tx, {
        entryDate: new Date(),
        description: `Return ${input.id}`,
        sourceType: "RETURN",
        sourceId: input.id,
        branchId: input.branchId,
        createdByUserId: input.processedByUserId,
        lines,
      });

      await this.recomputeOrderStatus(tx, input.orderId);
    });
  }

  private async recomputeOrderStatus(tx: Prisma.TransactionClient, orderId: string) {
    const [orderItems, returnItems] = await Promise.all([
      tx.orderItem.findMany({ where: { orderId } }),
      tx.returnItem.findMany({ where: { orderItem: { orderId } } }),
    ]);

    const orderedQty = orderItems.reduce((sum, i) => sum + i.quantity, 0);
    const returnedQty = returnItems.reduce((sum, i) => sum + i.quantity, 0);

    const status = returnedQty <= 0 ? "COMPLETED" : returnedQty >= orderedQty ? "REFUNDED" : "PARTIALLY_REFUNDED";
    await tx.order.update({ where: { id: orderId }, data: { status } });
  }
}
