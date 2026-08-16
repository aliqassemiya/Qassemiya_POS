import type { StockMovementType } from "@qassemiya/shared-types";
import { newId } from "../utils/uuid";
import type { Prisma } from "../../../generated/prisma";

export interface ApplyStockMovementParams {
  branchId: string;
  productVariantId: string;
  quantityChange: number;
  type: StockMovementType;
  referenceType?: string;
  referenceId?: string;
  note?: string;
  createdByUserId?: string;
  /** Use the same id as the caller's idempotency key (sync bundles). */
  movementId?: string;
}

/**
 * Single choke point for every stock mutation in the system: writes the
 * append-only StockMovement row and applies the delta to the materialized
 * Inventory balance via an atomic `quantityOnHand = quantityOnHand + delta`
 * (upsert + increment) — never a read-then-write. Never rejects for
 * insufficient/negative resulting stock; that is a reporting concern
 * (oversell alert), not a write-time constraint.
 *
 * Must be called with a transactional Prisma client so the ledger row and
 * the balance update are atomic together.
 */
export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  params: ApplyStockMovementParams,
): Promise<void> {
  await tx.stockMovement.create({
    data: {
      id: params.movementId ?? newId(),
      branchId: params.branchId,
      productVariantId: params.productVariantId,
      type: params.type,
      quantityChange: params.quantityChange,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      note: params.note,
      createdByUserId: params.createdByUserId,
    },
  });

  await tx.inventory.upsert({
    where: {
      branchId_productVariantId: { branchId: params.branchId, productVariantId: params.productVariantId },
    },
    create: {
      id: newId(),
      branchId: params.branchId,
      productVariantId: params.productVariantId,
      quantityOnHand: params.quantityChange,
    },
    update: {
      quantityOnHand: { increment: params.quantityChange },
    },
  });
}
