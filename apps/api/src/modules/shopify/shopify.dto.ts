import { z } from "zod";
import { createZodDto } from "nestjs-zod";

// accessToken is optional on update — omitted means "keep the existing
// token", so toggling isActive or changing the domain doesn't force
// re-entering it. Required the very first time (no integration row yet),
// enforced in the service since that depends on existing DB state, not
// something zod alone can express.
export const upsertShopifyIntegrationSchema = z.object({
  shopDomain: z.string().trim().min(1, "Shop domain is required"),
  accessToken: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});
export class UpsertShopifyIntegrationDto extends createZodDto(upsertShopifyIntegrationSchema) {}

export const testShopifyConnectionSchema = z.object({
  shopDomain: z.string().trim().min(1, "Shop domain is required"),
  accessToken: z.string().trim().min(1, "Access token is required"),
});
export class TestShopifyConnectionDto extends createZodDto(testShopifyConnectionSchema) {}

export const shopifyOrderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  // Plain "YYYY-MM-DD" -- what every <input type="date"> in the web app
  // actually sends; not a full ISO datetime string.
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  unmatchedOnly: z.coerce.boolean().optional(),
  // Matches order number (e.g. "#1001" or just "1001") OR any line item's SKU.
  search: z.string().trim().optional(),
});
export class ShopifyOrderListQueryDto extends createZodDto(shopifyOrderListQuerySchema) {}
