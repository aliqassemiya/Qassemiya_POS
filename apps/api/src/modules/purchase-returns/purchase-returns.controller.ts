import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PurchaseReturnsService } from "./purchase-returns.service";
import { CreatePurchaseReturnDto, PurchaseReturnListQueryDto } from "./purchase-returns.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/auth-request";

@Controller("purchase-returns")
@UseGuards(PermissionsGuard)
export class PurchaseReturnsController {
  constructor(private readonly purchaseReturnsService: PurchaseReturnsService) {}

  @Get()
  findAll(@Query() query: PurchaseReturnListQueryDto) {
    return this.purchaseReturnsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.purchaseReturnsService.findOne(id);
  }

  @Post()
  @RequirePermissions("purchases.return.create")
  create(@Body() dto: CreatePurchaseReturnDto, @CurrentUser() user: AuthenticatedUser) {
    return this.purchaseReturnsService.create(dto, user.userId);
  }
}
