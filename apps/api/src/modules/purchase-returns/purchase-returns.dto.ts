import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createPurchaseReturnSchema } from "@qassemiya/shared-types";

export class CreatePurchaseReturnDto extends createZodDto(createPurchaseReturnSchema) {}

export const purchaseReturnListQuerySchema = z.object({
  purchaseOrderId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});
export class PurchaseReturnListQueryDto extends createZodDto(purchaseReturnListQuerySchema) {}
