import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createShopifyReturnSchema } from "@qassemiya/shared-types";

export class CreateShopifyReturnDto extends createZodDto(createShopifyReturnSchema) {}

export const shopifyReturnsListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  shopifyOrderId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class ShopifyReturnsListQueryDto extends createZodDto(shopifyReturnsListQuerySchema) {}
