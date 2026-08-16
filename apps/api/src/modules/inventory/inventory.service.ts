import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { applyStockMovement } from "../../common/inventory/stock-ledger";
import { postJournalEntry, resolveAccountIdByCode } from "../../common/accounting/journal-ledger";
import type { InventoryListQueryDto, MovementsQueryDto, StockAdjustDto } from "./inventory.dto";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: InventoryListQueryDto) {
    const rows = await this.prisma.inventory.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.lowStockOnly ? { productVariant: { reorderPoint: { not: null } } } : {}),
      },
      include: { productVariant: { include: { product: true } }, branch: true },
      orderBy: { updatedAt: "desc" },
    });

    if (!query.lowStockOnly) return rows;
    return rows.filter(
      (r) => r.productVariant.reorderPoint !== null && r.quantityOnHand <= r.productVariant.reorderPoint!,
    );
  }

  findMovements(query: MovementsQueryDto) {
    return this.prisma.stockMovement.findMany({
      where: {
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
      },
      include: { productVariant: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
  }

  async adjust(dto: StockAdjustDto, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await applyStockMovement(tx, {
        branchId: dto.branchId,
        productVariantId: dto.productVariantId,
        quantityChange: dto.quantityChange,
        type: dto.type,
        note: dto.note,
        createdByUserId: userId,
        referenceType: "MANUAL_ADJUSTMENT",
      });

      // GL posting keyed off this specific call site (not off
      // StockMovementType — SalesService.void also uses type ADJUSTMENT and
      // is already GL-covered there). Only real stock-count corrections
      // (type ADJUSTMENT) post here; TRANSFER_IN/TRANSFER_OUT get no GL
      // entry since the chart of accounts is company-wide and a
      // branch-to-branch transfer nets to zero at the account level.
      if (dto.type === "ADJUSTMENT") {
        const variant = await tx.productVariant.findUniqueOrThrow({ where: { id: dto.productVariantId } });
        const value = Math.abs(dto.quantityChange) * Number(variant.costPrice);

        const [inventoryAccountId, shrinkageAccountId] = await Promise.all([
          resolveAccountIdByCode(tx, "1100"),
          resolveAccountIdByCode(tx, "6800"),
        ]);

        // Signed by quantityChange: a positive count-up increases Inventory
        // (Dr 1100 / Cr 6800); a negative count-down (shrinkage) decreases
        // it (Dr 6800 / Cr 1100).
        const lines =
          dto.quantityChange > 0
            ? [
                { accountId: inventoryAccountId, debit: value, description: "Stock adjustment (increase)" },
                { accountId: shrinkageAccountId, credit: value, description: "Stock adjustment (increase)" },
              ]
            : [
                { accountId: shrinkageAccountId, debit: value, description: "Stock adjustment (shrinkage)" },
                { accountId: inventoryAccountId, credit: value, description: "Stock adjustment (shrinkage)" },
              ];

        if (value > 0) {
          await postJournalEntry(tx, {
            entryDate: new Date(),
            description: dto.note ?? "Manual inventory adjustment",
            sourceType: "INVENTORY_ADJUSTMENT",
            sourceId: dto.productVariantId,
            branchId: dto.branchId,
            createdByUserId: userId,
            lines,
          });
        }
      }
    });

    return this.prisma.inventory.findUnique({
      where: { branchId_productVariantId: { branchId: dto.branchId, productVariantId: dto.productVariantId } },
    });
  }
}
