import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createExpenseSchema } from "@qassemiya/shared-types";

export class CreateExpenseDto extends createZodDto(createExpenseSchema) {}

export const expenseListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  categoryAccountId: z.string().uuid().optional(),
  // Plain "YYYY-MM-DD" -- what every <input type="date"> in the web app
  // actually sends; not a full ISO datetime string.
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class ExpenseListQueryDto extends createZodDto(expenseListQuerySchema) {}
