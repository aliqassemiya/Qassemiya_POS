import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ReturnsService } from "./returns.service";
import { CreateReturnDto, ReturnsListQueryDto } from "./returns.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";

@Controller("returns")
@UseGuards(PermissionsGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  findAll(@Query() query: ReturnsListQueryDto) {
    return this.returnsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.returnsService.findOne(id);
  }

  @Post()
  @RequirePermissions("pos.return.create")
  create(@Body() dto: CreateReturnDto) {
    return this.returnsService.create(dto);
  }
}
