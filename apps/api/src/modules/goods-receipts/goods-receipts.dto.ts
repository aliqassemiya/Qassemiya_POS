import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createGoodsReceiptSchema } from "@qassemiya/shared-types";

export class CreateGoodsReceiptDto extends createZodDto(createGoodsReceiptSchema) {}

export const goodsReceiptListQuerySchema = z.object({
  purchaseOrderId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});
export class GoodsReceiptListQueryDto extends createZodDto(goodsReceiptListQuerySchema) {}
