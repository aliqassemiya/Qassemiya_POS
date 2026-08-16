import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { productSchema, productVariantSchema, variantBulkUpdateSchema } from "@qassemiya/shared-types";

export const updateProductSchema = productSchema.omit({ variants: true }).partial();

export class CreateProductDto extends createZodDto(productSchema) {}
export class UpdateProductDto extends createZodDto(updateProductSchema) {}
export class CreateVariantDto extends createZodDto(productVariantSchema) {}
export class UpdateVariantDto extends createZodDto(productVariantSchema.partial()) {}
export class VariantBulkUpdateDto extends createZodDto(variantBulkUpdateSchema) {}

export const productListQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export class ProductListQueryDto extends createZodDto(productListQuerySchema) {}
