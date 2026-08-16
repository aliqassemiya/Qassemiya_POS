import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { VendorPaymentsService } from "./vendor-payments.service";
import { CreateVendorPaymentDto, VendorPaymentListQueryDto } from "./vendor-payments.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("vendor-payments")
@UseGuards(PermissionsGuard)
export class VendorPaymentsController {
  constructor(private readonly vendorPaymentsService: VendorPaymentsService) {}

  @Get()
  findAll(@Query() query: VendorPaymentListQueryDto) {
    return this.vendorPaymentsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.vendorPaymentsService.findOne(id);
  }

  @Post()
  @RequirePermissions("purchases.payment.create")
  create(@Body() dto: CreateVendorPaymentDto) {
    return this.vendorPaymentsService.create(dto);
  }
}
