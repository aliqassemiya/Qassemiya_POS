import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { UpdateVariantDto } from "./products.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

/**
 * Top-level /variants routes (distinct from /products) — this is the path
 * both the admin web app and the POS barcode-scan lookup call, matching the
 * approved plan's API surface ("GET /variants/barcode/:barcode",
 * "PATCH /variants/:id").
 */
@Controller("variants")
@UseGuards(PermissionsGuard)
export class VariantsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get("barcode/:barcode")
  findByBarcode(@Param("barcode") barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  @Patch(":variantId")
  @RequirePermissions("catalog.manage")
  update(@Param("variantId") variantId: string, @Body() dto: UpdateVariantDto) {
    return this.productsService.updateVariant(variantId, dto);
  }
}
