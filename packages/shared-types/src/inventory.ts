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
