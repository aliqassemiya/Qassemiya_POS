import { z } from "zod";
import { StockMovementType } from "./enums";

export const stockAdjustSchema = z.object({
  branchId: z.string().uuid(),
  productVariantId: z.string().uuid(),
  quantityChange: z.number().int().refine((n) => n !== 0, "quantityChange must not be zero"),
  type: z.nativeEnum(StockMovementType),
  note: z.string().optional(),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

// Instant branch-to-branch distribution (e.g. main warehouse -> store) —
// each line posts a paired TRANSFER_OUT at fromBranchId and TRANSFER_IN at
// toBranchId, atomically, linked by a shared referenceId.
export const stockTransferLineSchema = z.object({
  productVariantId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
export const stockTransferSchema = z
  .object({
    fromBranchId: z.string().uuid(),
    toBranchId: z.string().uuid(),
    note: z.string().optional(),
    lines: z.array(stockTransferLineSchema).min(1).max(500),
  })
  .refine((data) => data.fromBranchId !== data.toBranchId, {
    message: "Source and destination branch must differ",
    path: ["toBranchId"],
  });
export type StockTransferInput = z.infer<typeof stockTransferSchema>;

// Bulk stock-count reconciliation workflow: export current on-hand
// quantities to a spreadsheet, edit counts, re-upload — matched by
// productVariantId (preferred) or sku, within the given branch. The
// resulting delta (newQuantity - currentQuantity) is posted as a single
// ADJUSTMENT stock movement per row, same as a manual count correction.
export const inventoryBulkAdjustRowSchema = z.object({
  branchId: z.string().uuid(),
  productVariantId: z.string().uuid().optional(),
  sku: z.string().optional(),
  quantityOnHand: z.number().int().nonnegative(),
});
export const inventoryBulkAdjustSchema = z.object({
  rows: z.array(inventoryBulkAdjustRowSchema).min(1).max(5000),
});
export type InventoryBulkAdjustRow = z.infer<typeof inventoryBulkAdjustRowSchema>;
export type InventoryBulkAdjustInput = z.infer<typeof inventoryBulkAdjustSchema>;
