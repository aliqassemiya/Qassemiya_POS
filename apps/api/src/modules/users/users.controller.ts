import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { UsersService } from "./users.service";
import { AssignRoleDto, CreateUserDto, UpdateUserDto } from "./users.dto";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermissions } from "../../common/decorators/require-permissions.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/auth-request";

@Controller("users")
@UseGuards(PermissionsGuard)
@RequirePermissions("users.manage")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Method-level @RequirePermissions() with no args overrides the class-level
  // "users.manage" requirement (Reflector.getAllAndOverride prefers handler
  // metadata) — any authenticated user can read their own session, just not
  // the user list. Must stay above the ":id" route so Nest doesn't treat
  // "me" as an :id param.
  @Get("me")
  @RequirePermissions()
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user.userId);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // Must stay above ":id" for the same reason as "me" -- otherwise Nest
  // would treat "roles" as an :id param.
  @Get("roles")
  listRoles() {
    return this.usersService.listRoles();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post(":id/roles")
  assignRole(@Param("id") id: string, @Body() dto: AssignRoleDto) {
    return this.usersService.assignRole(id, dto);
  }

  @Delete(":id/roles/:userRoleId")
  removeRole(@Param("id") id: string, @Param("userRoleId") userRoleId: string) {
    return this.usersService.removeRole(id, userRoleId);
  }
}
