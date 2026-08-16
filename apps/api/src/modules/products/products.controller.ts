import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { CreateProductDto, CreateVariantDto, ProductListQueryDto, UpdateProductDto, VariantBulkUpdateDto } from "./products.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("products")
@UseGuards(PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() query: ProductListQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @RequirePermissions("catalog.manage")
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("catalog.manage")
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Post(":id/variants")
  @RequirePermissions("catalog.manage")
  addVariant(@Param("id") id: string, @Body() dto: CreateVariantDto) {
    return this.productsService.addVariant(id, dto);
  }

  @Post("bulk-update")
  @RequirePermissions("catalog.manage")
  bulkUpdateVariants(@Body() dto: VariantBulkUpdateDto) {
    return this.productsService.bulkUpdateVariants(dto);
  }
}
