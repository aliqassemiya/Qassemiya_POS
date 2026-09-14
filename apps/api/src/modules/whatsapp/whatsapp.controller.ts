import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { WhatsappService } from "./whatsapp.service";
import {
  MessageLogListQueryDto,
  TestWhatsAppConnectionDto,
  UpsertWhatsAppIntegrationDto,
} from "./whatsapp.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("whatsapp")
@UseGuards(PermissionsGuard)
@RequirePermissions("integrations.whatsapp.manage")
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get("integration")
  getIntegration() {
    return this.whatsappService.getIntegrationStatus();
  }

  @Put("integration")
  upsertIntegration(@Body() dto: UpsertWhatsAppIntegrationDto) {
    return this.whatsappService.upsertIntegration(dto);
  }

  @Post("integration/test-connection")
  testConnection(@Body() dto: TestWhatsAppConnectionDto) {
    return this.whatsappService.testConnection(dto);
  }

  // Overrides the class-level permission with none (just needs to be
  // authenticated) — matches SalesController's own findOne/findAll, since
  // viewing a WhatsApp delivery status on the Sale Detail page shouldn't
  // require the same SUPER_ADMIN-only permission as managing credentials.
  @Get("message-logs")
  @RequirePermissions()
  getMessageLogs(@Query() query: MessageLogListQueryDto) {
    return this.whatsappService.getMessageLogs(query);
  }

  @Post("orders/:orderId/resend")
  resend(@Param("orderId") orderId: string) {
    return this.whatsappService.resend(orderId);
  }
}
