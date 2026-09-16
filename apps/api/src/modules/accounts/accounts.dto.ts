import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { accountSchema, updateAccountSchema, AccountType } from "@qassemiya/shared-types";

export class CreateAccountDto extends createZodDto(accountSchema) {}
export class UpdateAccountDto extends createZodDto(updateAccountSchema) {}

export const accountListQuerySchema = z.object({
  type: z.nativeEnum(AccountType).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});
export class AccountListQueryDto extends createZodDto(accountListQuerySchema) {}

export const accountLedgerQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  // Plain "YYYY-MM-DD" -- what every <input type="date"> in the web app
  // actually sends; not a full ISO datetime string.
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});
export class AccountLedgerQueryDto extends createZodDto(accountLedgerQuerySchema) {}
