import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ShopifyReturnsService } from "./shopify-returns.service";
import { CreateShopifyReturnDto, ShopifyReturnsListQueryDto } from "./shopify-returns.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";

@Controller("shopify-returns")
@UseGuards(PermissionsGuard)
export class ShopifyReturnsController {
  constructor(private readonly shopifyReturnsService: ShopifyReturnsService) {}

  @Get()
  @RequirePermissions("reports.view")
  findAll(@Query() query: ShopifyReturnsListQueryDto) {
    return this.shopifyReturnsService.findAll(query);
  }

  @Get(":id")
  @RequirePermissions("reports.view")
  findOne(@Param("id") id: string) {
    return this.shopifyReturnsService.findOne(id);
  }

  @Post()
  @RequirePermissions("pos.return.create")
  create(@Body() dto: CreateShopifyReturnDto) {
    return this.shopifyReturnsService.create(dto);
  }

  // Public like InvoicesController: the id is an unguessable UUID, and this
  // lets the dashboard link to it as a plain <a href> / the PDF download as
  // a direct link, with no separate authenticated-fetch-and-blob handling
  // needed on the frontend. No @RequirePermissions here either, so
  // PermissionsGuard's class-level @UseGuards is a no-op for these two.
  @Public()
  @Get(":id/slip")
  async viewSlip(@Param("id") id: string, @Res() res: Response) {
    const html = await this.shopifyReturnsService.renderSlipHtml(id);
    res.type("html").send(html);
  }

  @Public()
  @Get(":id/slip/pdf")
  async downloadSlipPdf(@Param("id") id: string, @Res() res: Response) {
    const { buffer, fileName } = await this.shopifyReturnsService.renderSlipPdf(id);
    res.type("pdf").set("Content-Disposition", `attachment; filename="${fileName}"`).send(buffer);
  }
}
