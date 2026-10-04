import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import {
  InventoryBulkAdjustDto,
  InventoryListQueryDto,
  MovementsQueryDto,
  StockAdjustDto,
  StockTransferDto,
} from "./inventory.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/auth-request";

@Controller("inventory")
@UseGuards(PermissionsGuard)
@RequirePermissions("inventory.view")
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions("inventory.view", "inventory.view.allBranches")
  findAll(@Query() query: InventoryListQueryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get("movements")
  @RequirePermissions("inventory.view", "inventory.view.allBranches")
  findMovements(@Query() query: MovementsQueryDto) {
    return this.inventoryService.findMovements(query);
  }

  @Post("adjust")
  @RequirePermissions("inventory.adjust")
  adjust(@Body() dto: StockAdjustDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.adjust(dto, user.userId);
  }

  @Post("transfer")
  @RequirePermissions("inventory.adjust")
  transfer(@Body() dto: StockTransferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.transfer(dto, user.userId);
  }

  @Post("bulk-adjust")
  @RequirePermissions("inventory.adjust")
  bulkAdjust(@Body() dto: InventoryBulkAdjustDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.bulkAdjust(dto, user.userId);
  }
}
