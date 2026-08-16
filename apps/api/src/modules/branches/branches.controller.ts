import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { CreateBranchDto, UpdateBranchDto } from "./branches.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";

@Controller("branches")
@UseGuards(PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  // Public + must stay above ":id" — the POS pairing screen calls this
  // before any login/device exists, so it can offer a branch picker instead
  // of asking someone to type a raw UUID.
  @Public()
  @Get("public")
  findPublicList() {
    return this.branchesService.findPublicList();
  }

  @Get()
  findAll() {
    return this.branchesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.branchesService.findOne(id);
  }

  @Post()
  @RequirePermissions("branches.manage")
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("branches.manage")
  update(@Param("id") id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }
}
