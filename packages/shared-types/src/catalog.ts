import { z } from "zod";
import { BarcodeType } from "./enums";

export const categorySchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const productVariantSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().optional(),
  barcodeType: z.nativeEnum(BarcodeType).default(BarcodeType.CODE128),
  size: z.string().optional(),
  color: z.string().optional(),
  colorHex: z.string().optional(),
  costPrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  compareAtPrice: z.number().nonnegative().optional(),
  taxRate: z.number().min(0).max(100).default(15),
});
export type ProductVariantInput = z.infer<typeof productVariantSchema>;

export const productSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brand: z.string().optional(),
  vendorId: z.string().uuid().optional().nullable(),
  // One image per style/product, not per-variant — these are dresses, a
  // single garment shot represents every size/color variant of it.
  imageUrl: z.string().url().optional().or(z.literal("")),
  variants: z.array(productVariantSchema).min(1),
});
export type ProductInput = z.infer<typeof productSchema>;

// Bulk price-update workflow: export the product/variant list to a
// spreadsheet, edit prices, re-upload — matched by variantId (preferred) or
// falling back to sku, updating only whichever fields are present per row.
export const variantBulkUpdateRowSchema = z.object({
  variantId: z.string().uuid().optional(),
  sku: z.string().optional(),
  costPrice: z.number().nonnegative().optional(),
  sellingPrice: z.number().nonnegative().optional(),
  compareAtPrice: z.number().nonnegative().optional(),
  taxRate: z.number().min(0).max(100).optional(),
});
export const variantBulkUpdateSchema = z.object({
  rows: z.array(variantBulkUpdateRowSchema).min(1).max(5000),
});
export type VariantBulkUpdateRow = z.infer<typeof variantBulkUpdateRowSchema>;
export type VariantBulkUpdateInput = z.infer<typeof variantBulkUpdateSchema>;
