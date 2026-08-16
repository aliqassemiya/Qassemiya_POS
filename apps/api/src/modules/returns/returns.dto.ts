import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createReturnSchema } from "@qassemiya/shared-types";

export class CreateReturnDto extends createZodDto(createReturnSchema) {}

export const returnsListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
});
export class ReturnsListQueryDto extends createZodDto(returnsListQuerySchema) {}
