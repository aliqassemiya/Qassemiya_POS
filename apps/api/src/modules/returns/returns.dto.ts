import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createReturnSchema } from "@qassemiya/shared-types";

export class CreateReturnDto extends createZodDto(createReturnSchema) {}

export const returnsListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class ReturnsListQueryDto extends createZodDto(returnsListQuerySchema) {}
