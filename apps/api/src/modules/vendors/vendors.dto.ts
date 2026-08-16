import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { vendorSchema } from "@qassemiya/shared-types";

export const updateVendorSchema = vendorSchema.partial().extend({ isActive: z.boolean().optional() });

export class CreateVendorDto extends createZodDto(vendorSchema) {}
export class UpdateVendorDto extends createZodDto(updateVendorSchema) {}

export const vendorListQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});
export class VendorListQueryDto extends createZodDto(vendorListQuerySchema) {}
