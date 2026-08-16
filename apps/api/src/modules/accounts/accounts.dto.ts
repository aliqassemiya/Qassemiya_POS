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
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export class AccountLedgerQueryDto extends createZodDto(accountLedgerQuerySchema) {}
