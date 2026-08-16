import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createSaleSchema } from "@qassemiya/shared-types";

export class CreateSaleDto extends createZodDto(createSaleSchema) {}

export const salesListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  cashierUserId: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class SalesListQueryDto extends createZodDto(salesListQuerySchema) {}

export const voidSaleSchema = z.object({
  reason: z.string().optional(),
});
export class VoidSaleDto extends createZodDto(voidSaleSchema) {}
