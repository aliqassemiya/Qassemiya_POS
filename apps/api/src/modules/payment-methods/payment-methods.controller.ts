import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PaymentMethodsService } from "./payment-methods.service";
import { PermissionsGuard } from "../../common/guards/permissions.guard";

@Controller("payment-methods")
@UseGuards(PermissionsGuard)
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  findAll(@Query("activeOnly") activeOnly?: string) {
    return this.paymentMethodsService.findAll(activeOnly === "true");
  }
}
