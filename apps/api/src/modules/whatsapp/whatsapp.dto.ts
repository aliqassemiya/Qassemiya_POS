import { z } from "zod";
import { createZodDto } from "nestjs-zod";

// accessToken is optional on update — omitted means "keep the existing
// token" (mirrors ShopifyIntegration's upsert convention exactly).
export const upsertWhatsAppIntegrationSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "Phone number ID is required"),
  wabaId: z.string().trim().min(1, "WABA ID is required"),
  accessToken: z.string().trim().min(1).optional(),
  templateName: z.string().trim().min(1, "Template name is required"),
  templateLanguage: z.string().trim().min(1).default("ar"),
  isActive: z.boolean().optional(),
});
export class UpsertWhatsAppIntegrationDto extends createZodDto(upsertWhatsAppIntegrationSchema) {}

export const testWhatsAppConnectionSchema = z.object({
  phoneNumberId: z.string().trim().min(1, "Phone number ID is required"),
  accessToken: z.string().trim().min(1, "Access token is required"),
});
export class TestWhatsAppConnectionDto extends createZodDto(testWhatsAppConnectionSchema) {}

export const messageLogListQuerySchema = z.object({
  orderId: z.string().uuid().optional(),
});
export class MessageLogListQueryDto extends createZodDto(messageLogListQuerySchema) {}
