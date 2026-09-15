import { Body, Controller, Get, Post, Put, UseGuards } from "@nestjs/common";
import { TamaraService } from "./tamara.service";
import { CreateTamaraSessionDto, UpsertTamaraIntegrationDto } from "./tamara.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("tamara")
@UseGuards(PermissionsGuard)
@RequirePermissions("integrations.tamara.manage")
export class TamaraController {
  constructor(private readonly tamaraService: TamaraService) {}

  @Get("integration")
  getIntegration() {
    return this.tamaraService.getIntegrationStatus();
  }

  @Put("integration")
  upsertIntegration(@Body() dto: UpsertTamaraIntegrationDto) {
    return this.tamaraService.upsertIntegration(dto);
  }

  // Overrides the class-level permission -- this is the POS-checkout-time
  // call, gated by the ordinary sale-creation permission a cashier already
  // holds (matches WhatsappController's message-logs override).
  @Post("checkout-session")
  @RequirePermissions("pos.sale.create")
  createCheckoutSession(@Body() dto: CreateTamaraSessionDto) {
    return this.tamaraService.createInStoreSession(dto);
  }
}
