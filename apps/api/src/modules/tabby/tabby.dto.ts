import { z } from "zod";
import { createZodDto } from "nestjs-zod";

// secretKey is optional on update -- omitted means "keep the existing key"
// (mirrors Shopify/WhatsApp/Tamara's upsert convention).
export const upsertTabbyIntegrationSchema = z.object({
  secretKey: z.string().trim().min(1).optional(),
  merchantCode: z.string().trim().min(1, "Merchant code is required"),
  region: z.enum(["KSA", "UAE"]).default("KSA"),
  isActive: z.boolean().optional(),
});
export class UpsertTabbyIntegrationDto extends createZodDto(upsertTabbyIntegrationSchema) {}

export const createTabbySessionItemSchema = z.object({
  title: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  category: z.string().optional(),
});

export const createTabbySessionSchema = z.object({
  orderReferenceId: z.string().uuid(),
  // Required so PermissionsGuard's branch-scoped grants can match -- same
  // reasoning as Tamara's checkout-session DTO.
  branchId: z.string().uuid(),
  amount: z.number().positive(),
  phoneNumber: z.string().min(1),
  lang: z.enum(["ar", "en"]).default("ar"),
  items: z.array(createTabbySessionItemSchema).min(1),
});
export class CreateTabbySessionDto extends createZodDto(createTabbySessionSchema) {}
