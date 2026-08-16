import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { PurchaseInvoicesService } from "./purchase-invoices.service";
import { CreatePurchaseInvoiceDto, PurchaseInvoiceListQueryDto, UpdatePurchaseInvoiceDto } from "./purchase-invoices.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("purchase-invoices")
@UseGuards(PermissionsGuard)
export class PurchaseInvoicesController {
  constructor(private readonly purchaseInvoicesService: PurchaseInvoicesService) {}

  @Get()
  findAll(@Query() query: PurchaseInvoiceListQueryDto) {
    return this.purchaseInvoicesService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.purchaseInvoicesService.findOne(id);
  }

  @Post()
  @RequirePermissions("purchases.invoice.manage")
  create(@Body() dto: CreatePurchaseInvoiceDto) {
    return this.purchaseInvoicesService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("purchases.invoice.manage")
  update(@Param("id") id: string, @Body() dto: UpdatePurchaseInvoiceDto) {
    return this.purchaseInvoicesService.update(id, dto);
  }

  @Post(":id/cancel")
  @RequirePermissions("purchases.invoice.manage")
  cancel(@Param("id") id: string) {
    return this.purchaseInvoicesService.cancel(id);
  }
}
