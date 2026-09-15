import { z } from "zod";
import { createZodDto } from "nestjs-zod";

// apiKey is optional on update -- omitted means "keep the existing key"
// (mirrors ShopifyIntegration/WhatsAppIntegration's upsert convention).
export const upsertTamaraIntegrationSchema = z.object({
  apiKey: z.string().trim().min(1).optional(),
  environment: z.enum(["sandbox", "production"]).default("sandbox"),
  isActive: z.boolean().optional(),
});
export class UpsertTamaraIntegrationDto extends createZodDto(upsertTamaraIntegrationSchema) {}

export const createTamaraSessionItemSchema = z.object({
  referenceId: z.string().min(1),
  type: z.string().trim().min(1).default("Physical"),
  name: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  totalAmount: z.number().nonnegative(),
});

export const createTamaraSessionSchema = z.object({
  orderReferenceId: z.string().uuid(),
  // Required so PermissionsGuard's branch-scoped grants (e.g. a CASHIER's,
  // which are per-branch, not global like SUPER_ADMIN's) can actually match
  // -- the guard reads branchId off the request body for every branch-scoped
  // permission check, the same convention createSaleSchema already follows.
  // Also used server-side to derive the store_code sent to Tamara.
  branchId: z.string().uuid(),
  amount: z.number().positive(),
  phoneNumber: z.string().min(1),
  email: z.string().email().optional(),
  orderNumber: z.string().optional(),
  items: z.array(createTamaraSessionItemSchema).min(1),
});
export class CreateTamaraSessionDto extends createZodDto(createTamaraSessionSchema) {}
