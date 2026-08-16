import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createPurchaseInvoiceSchema, updatePurchaseInvoiceSchema, PurchaseInvoiceStatus } from "@qassemiya/shared-types";

export class CreatePurchaseInvoiceDto extends createZodDto(createPurchaseInvoiceSchema) {}
export class UpdatePurchaseInvoiceDto extends createZodDto(updatePurchaseInvoiceSchema) {}

export const purchaseInvoiceListQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  status: z.nativeEnum(PurchaseInvoiceStatus).optional(),
});
export class PurchaseInvoiceListQueryDto extends createZodDto(purchaseInvoiceListQuerySchema) {}
