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

export const customerListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class CustomerListQueryDto extends createZodDto(customerListQuerySchema) {}
