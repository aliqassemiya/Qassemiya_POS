import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { inventoryBulkAdjustSchema, stockAdjustSchema, stockTransferSchema } from "@qassemiya/shared-types";

export class StockAdjustDto extends createZodDto(stockAdjustSchema) {}
export class StockTransferDto extends createZodDto(stockTransferSchema) {}
export class InventoryBulkAdjustDto extends createZodDto(inventoryBulkAdjustSchema) {}

export const inventoryListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  // Matches product name, SKU, or barcode.
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class InventoryListQueryDto extends createZodDto(inventoryListQuerySchema) {}

export const movementsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  productVariantId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class MovementsQueryDto extends createZodDto(movementsQuerySchema) {}
