import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { applyStockMovement } from "../../common/inventory/stock-ledger";
import { postJournalEntry, resolveAccountIdByCode } from "../../common/accounting/journal-ledger";
import { newId } from "../../common/utils/uuid";
import type { CreateGoodsReceiptInput } from "@qassemiya/shared-types";
import type { CreateGoodsReceiptDto, GoodsReceiptListQueryDto } from "./goods-receipts.dto";
import type { Prisma } from "../../../generated/prisma";

const WITH_DETAILS = {
  items: { include: { productVariant: { include: { product: true } } } },
  purchaseOrder: { include: { vendor: true } },
  branch: true,
} as const;

@Injectable()
export class GoodsReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: GoodsReceiptListQueryDto) {
    return this.prisma.goodsReceipt.findMany({
      where: {
        ...(query.purchaseOrderId ? { purchaseOrderId: query.purchaseOrderId } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
      },
      include: WITH_DETAILS,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const gr = await this.prisma.goodsReceipt.findUnique({ where: { id }, include: WITH_DETAILS });
    if (!gr) throw new NotFoundException("Goods receipt not found");
    return gr;
  }

  async create(dto: CreateGoodsReceiptDto, userId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId } });
    if (!po) throw new NotFoundException("Purchase order not found");
    if (po.status === "CANCELLED") throw new ConflictException("Cannot receive against a cancelled purchase order");
    if (po.status === "RECEIVED") throw new ConflictException("Purchase order is already fully received");

    const id = await this.createGoodsReceiptTx(dto, userId);
    return this.findOne(id);
  }

  /** Mirrors ReturnsService.createReturnTx: header+items in a transaction, applyStockMovement()
   * per line, atomic quantityReceived increment, last-cost update, then recompute PO status.
   * Server-generates the id (purchasing is admin-only, never created offline). */
  async createGoodsReceiptTx(input: CreateGoodsReceiptInput, userId: string): Promise<string> {
    const id = newId();
    await this.prisma.$transaction(async (tx) => {
      await tx.goodsReceipt.create({
        data: {
          id,
          purchaseOrderId: input.purchaseOrderId,
          branchId: input.branchId,
          receivedByUserId: userId,
          deliveryNoteRef: input.deliveryNoteRef,
          notes: input.notes,
          items: {
            create: input.items.map((item) => ({
              id: newId(),
              purchaseOrderItemId: item.purchaseOrderItemId,
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              unitCost: item.unitCost,
            })),
          },
        },
      });

      let receivedValueTotal = 0;
      for (const item of input.items) {
        await applyStockMovement(tx, {
          branchId: input.branchId,
          productVariantId: item.productVariantId,
          quantityChange: item.quantity,
          type: "PURCHASE_RECEIVE",
          referenceType: "GOODS_RECEIPT",
          referenceId: id,
          createdByUserId: userId,
        });

        // Atomic increment — never read-then-write, same pattern as Inventory.quantityOnHand.
        await tx.purchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: { quantityReceived: { increment: item.quantity } },
        });

        // Last-cost method: future sale margins reflect the latest vendor cost.
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { costPrice: item.unitCost },
        });

        receivedValueTotal += item.quantity * item.unitCost;
      }

      // GL posting: Dr 1100 Inventory / Cr 2050 GRNI — goods physically
      // received but not yet vendor-invoiced. The matching Purchase Invoice
      // posting later clears (a best-effort PO-level portion of) this GRNI
      // balance; no exact GR-line-level clearing exists (see PurchaseInvoicesService).
      const [inventoryAccountId, grniAccountId] = await Promise.all([
        resolveAccountIdByCode(tx, "1100"),
        resolveAccountIdByCode(tx, "2050"),
      ]);
      await postJournalEntry(tx, {
        entryDate: new Date(),
        description: `Goods receipt ${id}`,
        sourceType: "GOODS_RECEIPT",
        sourceId: id,
        branchId: input.branchId,
        createdByUserId: userId,
        lines: [
          { accountId: inventoryAccountId, debit: receivedValueTotal, description: "Inventory received" },
          { accountId: grniAccountId, credit: receivedValueTotal, description: "Goods received not invoiced" },
        ],
      });

      await this.recomputePurchaseOrderStatus(tx, input.purchaseOrderId);
    });
    return id;
  }

  private async recomputePurchaseOrderStatus(tx: Prisma.TransactionClient, purchaseOrderId: string) {
    const items = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId } });

    const orderedQty = items.reduce((sum, i) => sum + i.quantityOrdered, 0);
    const receivedQty = items.reduce((sum, i) => sum + i.quantityReceived, 0);

    const status = receivedQty <= 0 ? "SUBMITTED" : receivedQty >= orderedQty ? "RECEIVED" : "PARTIALLY_RECEIVED";
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status } });
  }
}
