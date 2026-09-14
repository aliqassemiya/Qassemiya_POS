import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createPurchaseInvoiceSchema, updatePurchaseInvoiceSchema, PurchaseInvoiceStatus } from "@qassemiya/shared-types";

export class CreatePurchaseInvoiceDto extends createZodDto(createPurchaseInvoiceSchema) {}
export class UpdatePurchaseInvoiceDto extends createZodDto(updatePurchaseInvoiceSchema) {}

export const purchaseInvoiceListQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  status: z.nativeEnum(PurchaseInvoiceStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export class PurchaseInvoiceListQueryDto extends createZodDto(purchaseInvoiceListQuerySchema) {}
