import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ShopifyService } from "./shopify.service";
import {
  ShopifyOrderListQueryDto,
  TestShopifyConnectionDto,
  UpsertShopifyIntegrationDto,
} from "./shopify.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("shopify")
@UseGuards(PermissionsGuard)
@RequirePermissions("integrations.shopify.manage")
export class ShopifyController {
  constructor(private readonly shopifyService: ShopifyService) {}

  @Get("integration")
  getIntegration() {
    return this.shopifyService.getIntegrationStatus();
  }

  @Put("integration")
  upsertIntegration(@Body() dto: UpsertShopifyIntegrationDto) {
    return this.shopifyService.upsertIntegration(dto);
  }

  @Post("integration/test-connection")
  testConnection(@Body() dto: TestShopifyConnectionDto) {
    return this.shopifyService.testConnection(dto);
  }

  @Post("sync/run")
  runSync() {
    return this.shopifyService.runSync("MANUAL");
  }

  @Get("sync/logs")
  getSyncLogs() {
    return this.shopifyService.getSyncLogs();
  }

  @Get("sync/logs/:id/entries")
  getSyncLogEntries(@Param("id") id: string) {
    return this.shopifyService.getSyncLogEntries(id);
  }

  @Get("orders")
  @RequirePermissions("reports.view")
  findOrders(@Query() query: ShopifyOrderListQueryDto) {
    return this.shopifyService.findOrders(query);
  }

  @Get("orders/:id")
  @RequirePermissions("reports.view")
  findOrder(@Param("id") id: string) {
    return this.shopifyService.findOrder(id);
  }
}
