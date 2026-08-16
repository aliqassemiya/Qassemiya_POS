import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PurchaseOrdersService } from "./purchase-orders.service";
import { CreatePurchaseOrderDto, PurchaseOrderListQueryDto, UpdatePurchaseOrderDto } from "./purchase-orders.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/auth-request";

@Controller("purchase-orders")
@UseGuards(PermissionsGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  findAll(@Query() query: PurchaseOrderListQueryDto) {
    return this.purchaseOrdersService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Post()
  @RequirePermissions("purchases.po.manage")
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseOrdersService.create(dto, user.userId);
  }

  @Patch(":id")
  @RequirePermissions("purchases.po.manage")
  update(@Param("id") id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchaseOrdersService.update(id, dto);
  }

  @Post(":id/submit")
  @RequirePermissions("purchases.po.manage")
  submit(@Param("id") id: string) {
    return this.purchaseOrdersService.submit(id);
  }

  @Post(":id/cancel")
  @RequirePermissions("purchases.po.manage")
  cancel(@Param("id") id: string) {
    return this.purchaseOrdersService.cancel(id);
  }
}
