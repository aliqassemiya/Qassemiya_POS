import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { TabbyService } from "./tabby.service";
import { CreateTabbySessionDto, UpsertTabbyIntegrationDto } from "./tabby.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("tabby")
@UseGuards(PermissionsGuard)
@RequirePermissions("integrations.tabby.manage")
export class TabbyController {
  constructor(private readonly tabbyService: TabbyService) {}

  @Get("integration")
  getIntegration() {
    return this.tabbyService.getIntegrationStatus();
  }

  @Put("integration")
  upsertIntegration(@Body() dto: UpsertTabbyIntegrationDto) {
    return this.tabbyService.upsertIntegration(dto);
  }

  // Overrides the class-level permission -- this is the POS-checkout-time
  // call, gated by the ordinary sale-creation permission a cashier already
  // holds (matches TamaraController's checkout-session override).
  @Post("checkout-session")
  @RequirePermissions("pos.sale.create")
  createCheckoutSession(@Body() dto: CreateTabbySessionDto) {
    return this.tabbyService.createInStoreSession(dto);
  }
}
