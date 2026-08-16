import { z } from "zod";
import { AccountType, NormalBalance } from "./enums";

// Chart of Accounts, journal entries (manual) and expenses are all
// admin-only and never created offline by POS — like purchasing.ts, none of
// these schemas take a client-supplied `id`; every id is server-generated
// via newId() in the service layer.

export const accountSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  type: z.nativeEnum(AccountType),
  normalBalance: z.nativeEnum(NormalBalance),
  parentId: z.string().uuid().optional().nullable(),
});
export type AccountInput = z.infer<typeof accountSchema>;

// code/type/isSystem are intentionally absent — same technique
// updatePurchaseOrderSchema uses to make fields immutable via the API,
// here protecting auto-posting-critical accounts from being redefined.
export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  nameAr: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const journalLineInputSchema = z
  .object({
    accountId: z.string().uuid(),
    debit: z.number().nonnegative().default(0),
    credit: z.number().nonnegative().default(0),
    description: z.string().optional(),
  })
  .refine((line) => line.debit > 0 || line.credit > 0, {
    message: "Each journal line must have a positive debit or credit",
  })
  .refine((line) => !(line.debit > 0 && line.credit > 0), {
    message: "A journal line cannot have both a debit and a credit",
  });
export type JournalLineInput = z.infer<typeof journalLineInputSchema>;

// Manual entries only — sourceType is always hardcoded to "MANUAL" by
// JournalEntriesService, never client-supplied. Auto-posted entries (sale,
// return, purchase, etc.) are created internally via postJournalEntry(),
// not through this DTO.
export const createJournalEntrySchema = z.object({
  entryDate: z.string().datetime().optional(),
  description: z.string().min(1),
  branchId: z.string().uuid().optional(),
  lines: z.array(journalLineInputSchema).min(2),
});
export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;

export const createExpenseSchema = z.object({
  branchId: z.string().uuid().optional(),
  categoryAccountId: z.string().uuid(),
  amount: z.number().positive(),
  paidByMethodId: z.string().uuid(),
  expenseDate: z.string().datetime().optional(),
  description: z.string().optional(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
