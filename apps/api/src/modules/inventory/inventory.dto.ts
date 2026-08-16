import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { stockAdjustSchema } from "@qassemiya/shared-types";

export class StockAdjustDto extends createZodDto(stockAdjustSchema) {}

export const inventoryListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  lowStockOnly: z.coerce.boolean().optional(),
});
export class InventoryListQueryDto extends createZodDto(inventoryListQuerySchema) {}

export const movementsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  productVariantId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class MovementsQueryDto extends createZodDto(movementsQuerySchema) {}
