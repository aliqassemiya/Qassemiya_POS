import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto, ResetPinDto, UpdateEmployeeDto } from "./employees.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("employees")
@UseGuards(PermissionsGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(@Query("branchId") branchId?: string) {
    return this.employeesService.findAll(branchId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  @RequirePermissions("employees.manage")
  create(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("employees.manage")
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employeesService.update(id, dto);
  }

  @Post(":id/reset-pin")
  @RequirePermissions("employees.manage")
  resetPin(@Param("id") id: string, @Body() dto: ResetPinDto) {
    return this.employeesService.resetPin(id, dto);
  }
}
