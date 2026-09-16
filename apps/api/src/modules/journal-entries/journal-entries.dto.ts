import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createJournalEntrySchema } from "@qassemiya/shared-types";

export class CreateJournalEntryDto extends createZodDto(createJournalEntrySchema) {}

export const journalEntryListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  // Plain "YYYY-MM-DD" -- what every <input type="date"> in the web app
  // actually sends; not a full ISO datetime string.
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class JournalEntryListQueryDto extends createZodDto(journalEntryListQuerySchema) {}
