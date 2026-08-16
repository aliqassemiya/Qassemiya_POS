import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { InventoryListQueryDto, MovementsQueryDto, StockAdjustDto } from "./inventory.dto";
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
  findAll(@Query() query: InventoryListQueryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get("movements")
  findMovements(@Query() query: MovementsQueryDto) {
    return this.inventoryService.findMovements(query);
  }

  @Post("adjust")
  @RequirePermissions("inventory.adjust")
  adjust(@Body() dto: StockAdjustDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventoryService.adjust(dto, user.userId);
  }
}
