import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createJournalEntrySchema } from "@qassemiya/shared-types";

export class CreateJournalEntryDto extends createZodDto(createJournalEntrySchema) {}

export const journalEntryListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class JournalEntryListQueryDto extends createZodDto(journalEntryListQuerySchema) {}
