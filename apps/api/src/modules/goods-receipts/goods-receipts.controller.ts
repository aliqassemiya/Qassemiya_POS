import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { GoodsReceiptsService } from "./goods-receipts.service";
import { CreateGoodsReceiptDto, GoodsReceiptListQueryDto } from "./goods-receipts.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/auth-request";

@Controller("goods-receipts")
@UseGuards(PermissionsGuard)
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Get()
  findAll(@Query() query: GoodsReceiptListQueryDto) {
    return this.goodsReceiptsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.goodsReceiptsService.findOne(id);
  }

  @Post()
  @RequirePermissions("purchases.receive")
  create(@Body() dto: CreateGoodsReceiptDto, @CurrentUser() user: AuthenticatedUser) {
    return this.goodsReceiptsService.create(dto, user.userId);
  }
}
