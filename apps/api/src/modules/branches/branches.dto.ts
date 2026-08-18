import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const createBranchSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  vatNumber: z.string().optional(),
});
export const updateBranchSchema = createBranchSchema.partial().extend({
  isActive: z.boolean().optional(),
  isWarehouse: z.boolean().optional(),
});

export class CreateBranchDto extends createZodDto(createBranchSchema) {}
export class UpdateBranchDto extends createZodDto(updateBranchSchema) {}
