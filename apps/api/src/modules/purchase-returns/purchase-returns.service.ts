import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { applyStockMovement } from "../../common/inventory/stock-ledger";
import { postJournalEntry, resolveAccountIdByCode } from "../../common/accounting/journal-ledger";
import { newId } from "../../common/utils/uuid";
import type { CreatePurchaseReturnInput } from "@qassemiya/shared-types";
import type { CreatePurchaseReturnDto, PurchaseReturnListQueryDto } from "./purchase-returns.dto";

const WITH_DETAILS = {
  items: { include: { purchaseOrderItem: { include: { productVariant: { include: { product: true } } } } } },
  purchaseOrder: { include: { vendor: true } },
  branch: true,
} as const;

@Injectable()
export class PurchaseReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PurchaseReturnListQueryDto) {
    const where = {
      ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
    };
    const [data, totalCount] = await Promise.all([
      this.prisma.purchaseReturn.findMany({
        where,
        include: WITH_DETAILS,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.purchaseReturn.count({ where }),
    ]);
    return { data, totalCount };
  }

  async findOne(id: string) {
    const ret = await this.prisma.purchaseReturn.findUnique({ where: { id }, include: WITH_DETAILS });
    if (!ret) throw new NotFoundException("Purchase return not found");
    return ret;
  }

  async create(dto: CreatePurchaseReturnDto, userId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId } });
    if (!po) throw new NotFoundException("Purchase order not found");

    const id = await this.createPurchaseReturnTx(dto, userId);
    return this.findOne(id);
  }

  /** Mirrors ReturnsService.createReturnTx exactly, save for a server-generated id
   * (purchasing is admin-only, never created offline by POS unlike Sales/Returns). */
  async createPurchaseReturnTx(input: CreatePurchaseReturnInput, userId: string): Promise<string> {
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseReturn.create({
        data: {
          id,
          purchaseOrderId: input.purchaseOrderId,
          branchId: input.branchId,
          processedByUserId: userId,
          reason: input.reason,
          totalCreditAmount: input.totalCreditAmount,
          items: {
            create: input.items.map((item) => ({
              id: newId(),
              purchaseOrderItemId: item.purchaseOrderItemId,
              quantity: item.quantity,
              creditAmount: item.creditAmount,
            })),
          },
        },
      });

      for (const item of input.items) {
        const poItem = await tx.purchaseOrderItem.findUnique({ where: { id: item.purchaseOrderItemId } });
        if (!poItem) continue;
        await applyStockMovement(tx, {
          branchId: input.branchId,
          productVariantId: poItem.productVariantId,
          quantityChange: -item.quantity,
          type: "PURCHASE_RETURN",
          referenceType: "PURCHASE_RETURN",
          referenceId: id,
          createdByUserId: userId,
        });
      }

      // GL posting: Dr 2000 Accounts Payable / Cr 1100 Inventory — matches
      // how vendorBalances already nets return credits against invoiced
      // totals directly (not GRNI).
      const [apAccountId, inventoryAccountId] = await Promise.all([
        resolveAccountIdByCode(tx, "2000"),
        resolveAccountIdByCode(tx, "1100"),
      ]);
      await postJournalEntry(tx, {
        entryDate: new Date(),
        description: `Purchase return ${id}`,
        sourceType: "PURCHASE_RETURN",
        sourceId: id,
        branchId: input.branchId,
        createdByUserId: userId,
        lines: [
          { accountId: apAccountId, debit: input.totalCreditAmount, description: "AP credit from vendor" },
          { accountId: inventoryAccountId, credit: input.totalCreditAmount, description: "Inventory returned to vendor" },
        ],
      });
    });
    return id;
  }
}
