import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const createCustomerSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1, "Phone number is required"),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
});
export const updateCustomerSchema = createCustomerSchema.partial();

export class CreateCustomerDto extends createZodDto(createCustomerSchema) {}
export class UpdateCustomerDto extends createZodDto(updateCustomerSchema) {}
