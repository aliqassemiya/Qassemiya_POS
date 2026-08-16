import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createPurchaseOrderSchema, updatePurchaseOrderSchema, PurchaseOrderStatus } from "@qassemiya/shared-types";

export class CreatePurchaseOrderDto extends createZodDto(createPurchaseOrderSchema) {}
export class UpdatePurchaseOrderDto extends createZodDto(updatePurchaseOrderSchema) {}

export const purchaseOrderListQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export class PurchaseOrderListQueryDto extends createZodDto(purchaseOrderListQuerySchema) {}
