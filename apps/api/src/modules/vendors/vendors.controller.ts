import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { VendorsService } from "./vendors.service";
import { CreateVendorDto, UpdateVendorDto, VendorListQueryDto } from "./vendors.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("vendors")
@UseGuards(PermissionsGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll(@Query() query: VendorListQueryDto) {
    return this.vendorsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.vendorsService.findOne(id);
  }

  @Get(":id/statement")
  statement(@Param("id") id: string) {
    return this.vendorsService.statement(id);
  }

  @Post()
  @RequirePermissions("vendors.manage")
  create(@Body() dto: CreateVendorDto) {
    return this.vendorsService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("vendors.manage")
  update(@Param("id") id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorsService.update(id, dto);
  }
}
