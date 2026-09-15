import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { SalesService } from "./sales.service";
import { CreateSaleDto, SalesListQueryDto, VoidSaleDto } from "./sales.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("sales")
@UseGuards(PermissionsGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  findAll(@Query() query: SalesListQueryDto) {
    return this.salesService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.salesService.findOne(id);
  }

  @Post()
  @RequirePermissions("pos.sale.create")
  create(@Body() dto: CreateSaleDto) {
    return this.salesService.create(dto);
  }

  @Post(":id/void")
  @RequirePermissions("pos.sale.void")
  void(@Param("id") id: string, @Body() dto: VoidSaleDto) {
    return this.salesService.void(id, dto);
  }

  @Post(":id/payments/:paymentId/confirm")
  @RequirePermissions("pos.payment.confirm")
  confirmPayment(@Param("id") id: string, @Param("paymentId") paymentId: string) {
    return this.salesService.confirmPayment(id, paymentId);
  }
}
