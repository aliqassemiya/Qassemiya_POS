import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createExpenseSchema } from "@qassemiya/shared-types";

export class CreateExpenseDto extends createZodDto(createExpenseSchema) {}

export const expenseListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  categoryAccountId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export class ExpenseListQueryDto extends createZodDto(expenseListQuerySchema) {}
