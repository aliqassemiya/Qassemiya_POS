import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { applyStockMovement } from "../../common/inventory/stock-ledger";
import { postJournalEntry, resolveAccountIdByCode } from "../../common/accounting/journal-ledger";
import { newId } from "../../common/utils/uuid";
import type {
  InventoryBulkAdjustDto,
  InventoryListQueryDto,
  MovementsQueryDto,
  StockAdjustDto,
  StockTransferDto,
} from "./inventory.dto";

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: InventoryListQueryDto) {
    const where = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.search
        ? {
            OR: [
              { productVariant: { sku: { contains: query.search, mode: "insensitive" as const } } },
              { productVariant: { barcode: { contains: query.search, mode: "insensitive" as const } } },
              { productVariant: { product: { name: { contains: query.search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };
    const [data, totalCount] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        include: { productVariant: { include: { product: true } }, branch: true },
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventory.count({ where }),
    ]);
    return { data, totalCount };
  }

  async findMovements(query: MovementsQueryDto) {
    const where = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
    };
    const [data, totalCount] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: { productVariant: { include: { product: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { data, totalCount };
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

  /**
   * Instant branch-to-branch distribution (e.g. main warehouse -> store).
   * Each line posts a paired TRANSFER_OUT/TRANSFER_IN atomically, linked by
   * a shared referenceId. No GL entry — the chart of accounts is
   * company-wide, so a transfer nets to zero at the account level (same
   * reasoning as the existing adjust() TRANSFER_IN/OUT comment above).
   */
  async transfer(dto: StockTransferDto, userId: string) {
    const transferId = newId();
    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        await applyStockMovement(tx, {
          branchId: dto.fromBranchId,
          productVariantId: line.productVariantId,
          quantityChange: -line.quantity,
          type: "TRANSFER_OUT",
          referenceType: "STOCK_TRANSFER",
          referenceId: transferId,
          note: dto.note,
          createdByUserId: userId,
        });
        await applyStockMovement(tx, {
          branchId: dto.toBranchId,
          productVariantId: line.productVariantId,
          quantityChange: line.quantity,
          type: "TRANSFER_IN",
          referenceType: "STOCK_TRANSFER",
          referenceId: transferId,
          note: dto.note,
          createdByUserId: userId,
        });
      }
    });

    return this.prisma.inventory.findMany({
      where: {
        branchId: { in: [dto.fromBranchId, dto.toBranchId] },
        productVariantId: { in: dto.lines.map((l) => l.productVariantId) },
      },
      include: { productVariant: { include: { product: true } }, branch: true },
    });
  }

  /**
   * Bulk stock-count reconciliation from an uploaded CSV — matches each row
   * by productVariantId (preferred) or sku within its branch, computes the
   * delta against the current on-hand quantity, and posts it as a single
   * ADJUSTMENT movement per row via the same choke point manual adjustments
   * use. Rows with zero delta are skipped (nothing to reconcile).
   */
  async bulkAdjust(dto: InventoryBulkAdjustDto, userId: string) {
    let updated = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (const [index, row] of dto.rows.entries()) {
      const { branchId, productVariantId, sku, quantityOnHand } = row;
      if (!productVariantId && !sku) {
        errors.push({ row: index + 1, message: "Row has neither productVariantId nor sku" });
        continue;
      }

      try {
        const variant = await this.prisma.productVariant.findUniqueOrThrow({
          where: productVariantId ? { id: productVariantId } : { sku: sku! },
        });
        const existing = await this.prisma.inventory.findUnique({
          where: { branchId_productVariantId: { branchId, productVariantId: variant.id } },
        });
        const currentQty = existing?.quantityOnHand ?? 0;
        const delta = quantityOnHand - currentQty;
        if (delta === 0) continue;

        await this.prisma.$transaction((tx) =>
          applyStockMovement(tx, {
            branchId,
            productVariantId: variant.id,
            quantityChange: delta,
            type: "ADJUSTMENT",
            referenceType: "BULK_IMPORT",
            note: "Bulk inventory CSV import",
            createdByUserId: userId,
          }),
        );
        updated += 1;
      } catch {
        errors.push({
          row: index + 1,
          message: `No variant found for ${productVariantId ? `id ${productVariantId}` : `sku ${sku}`}`,
        });
      }
    }

    return { updated, errorCount: errors.length, errors };
  }
}
