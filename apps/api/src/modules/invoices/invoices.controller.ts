import { Controller, Get, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import { InvoicesService } from "./invoices.service";
import { Public } from "../../common/decorators/public.decorator";

// Deliberately outside any PermissionsGuard/@UseGuards — this is the
// customer-facing page opened from the WhatsApp invoice link, so it must be
// reachable with no login. @Public() only bypasses the global JwtAuthGuard;
// this controller was never given a PermissionsGuard in the first place.
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Public()
  @Get(":id")
  async view(@Param("id") id: string, @Res() res: Response) {
    const html = await this.invoicesService.renderInvoiceHtml(id);
    res.type("html").send(html);
  }

  @Public()
  @Get(":id/pdf")
  async downloadPdf(@Param("id") id: string, @Res() res: Response) {
    const { buffer, fileName } = await this.invoicesService.renderInvoicePdf(id);
    res.type("pdf").set("Content-Disposition", `attachment; filename="${fileName}"`).send(buffer);
  }
}
