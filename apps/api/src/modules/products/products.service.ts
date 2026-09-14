import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import type {
  CreateProductDto,
  CreateVariantDto,
  ProductListQueryDto,
  UpdateProductDto,
  UpdateVariantDto,
  VariantBulkUpdateDto,
} from "./products.dto";

const WITH_VARIANTS = { variants: true, category: true, vendor: true } as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProductListQueryDto) {
    const where = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" as const } },
              { variants: { some: { sku: { contains: query.search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };

    const [data, totalCount] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: WITH_VARIANTS,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, totalCount };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: WITH_VARIANTS });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  async findByBarcode(barcode: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { barcode },
      include: { product: true },
    });
    if (!variant) throw new NotFoundException("No variant found for that barcode");
    return variant;
  }

  async create(dto: CreateProductDto) {
    const skus = dto.variants.map((v) => v.sku);
    const barcodes = dto.variants.map((v) => v.barcode).filter((b): b is string => Boolean(b));
    const [existingSku] = await this.prisma.productVariant.findMany({ where: { sku: { in: skus } } });
    if (existingSku) throw new ConflictException(`SKU already in use: ${existingSku.sku}`);
    if (barcodes.length) {
      const [existingBarcode] = await this.prisma.productVariant.findMany({ where: { barcode: { in: barcodes } } });
      if (existingBarcode) throw new ConflictException(`Barcode already in use: ${existingBarcode.barcode}`);
    }

    const productId = newId();
    await this.prisma.product.create({
      data: {
        id: productId,
        name: dto.name,
        nameAr: dto.nameAr,
        description: dto.description,
        categoryId: dto.categoryId,
        brand: dto.brand,
        vendorId: dto.vendorId,
        imageUrl: dto.imageUrl || undefined,
        variants: {
          create: dto.variants.map((v) => ({
            id: newId(),
            sku: v.sku,
            barcode: v.barcode,
            barcodeType: v.barcodeType,
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            costPrice: v.costPrice,
            sellingPrice: v.sellingPrice,
            compareAtPrice: v.compareAtPrice,
            taxRate: v.taxRate,
          })),
        },
      },
    });

    return this.findOne(productId);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    await this.prisma.product.update({ where: { id }, data: dto });
    return this.findOne(id);
  }

  async addVariant(productId: string, dto: CreateVariantDto) {
    await this.findOne(productId);
    const existing = await this.prisma.productVariant.findUnique({ where: { sku: dto.sku } });
    if (existing) throw new ConflictException("SKU already in use");

    await this.prisma.productVariant.create({
      data: {
        id: newId(),
        productId,
        sku: dto.sku,
        barcode: dto.barcode,
        barcodeType: dto.barcodeType,
        size: dto.size,
        color: dto.color,
        colorHex: dto.colorHex,
        costPrice: dto.costPrice,
        sellingPrice: dto.sellingPrice,
        compareAtPrice: dto.compareAtPrice,
        taxRate: dto.taxRate,
      },
    });
    return this.findOne(productId);
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException("Variant not found");
    await this.prisma.productVariant.update({ where: { id: variantId }, data: dto });
    return this.findOne(variant.productId);
  }

  /**
   * Bulk price-update from an exported/re-uploaded spreadsheet. Each row is
   * applied independently (one bad row doesn't block the rest) — matched by
   * variantId first, falling back to sku, updating only the fields present
   * on that row.
   */
  async bulkUpdateVariants(dto: VariantBulkUpdateDto) {
    let updated = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (const [index, row] of dto.rows.entries()) {
      const { variantId, sku, ...fields } = row;
      if (!variantId && !sku) {
        errors.push({ row: index + 1, message: "Row has neither variantId nor sku" });
        continue;
      }
      if (Object.values(fields).every((v) => v === undefined)) continue; // nothing to update on this row

      try {
        const where = variantId ? { id: variantId } : { sku: sku! };
        await this.prisma.productVariant.update({ where, data: fields });
        updated += 1;
      } catch {
        errors.push({ row: index + 1, message: `No variant found for ${variantId ? `id ${variantId}` : `sku ${sku}`}` });
      }
    }

    return { updated, errorCount: errors.length, errors };
  }
}
