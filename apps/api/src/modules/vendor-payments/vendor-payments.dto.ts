import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createVendorPaymentSchema } from "@qassemiya/shared-types";

export class CreateVendorPaymentDto extends createZodDto(createVendorPaymentSchema) {}

export const vendorPaymentListQuerySchema = z.object({
  vendorId: z.string().uuid().optional(),
  purchaseInvoiceId: z.string().uuid().optional(),
});
export class VendorPaymentListQueryDto extends createZodDto(vendorPaymentListQuerySchema) {}
