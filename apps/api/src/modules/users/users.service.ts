import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import { buildAuthUser } from "../../common/auth/auth-user.util";
import type { AssignRoleDto, CreateUserDto, UpdateUserDto } from "./users.dto";

const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  userRoles: { include: { role: true, branch: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({ select: SAFE_SELECT, orderBy: { createdAt: "asc" } });
  }

  /** Backs the role picker on the Users management page's role-assignment form. */
  listRoles() {
    return this.prisma.role.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
  }

  getMe(userId: string) {
    return buildAuthUser(this.prisma, userId);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: { id: newId(), email: dto.email, fullName: dto.fullName, passwordHash },
    });
    return this.findOne(user.id);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password !== undefined) data.passwordHash = await argon2.hash(dto.password);
    await this.prisma.user.update({ where: { id }, data });
    return this.findOne(id);
  }

  async assignRole(userId: string, dto: AssignRoleDto) {
    await this.findOne(userId);
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException("Role not found");

    // Prisma's composite-unique where clause rejects null members, so a
    // nullable branchId (global grants) needs a manual find-then-create.
    const branchId = dto.branchId ?? null;
    const existing = await this.prisma.userRole.findFirst({ where: { userId, roleId: dto.roleId, branchId } });
    if (!existing) {
      await this.prisma.userRole.create({ data: { id: newId(), userId, roleId: dto.roleId, branchId } });
    }
    return this.findOne(userId);
  }

  async removeRole(userId: string, userRoleId: string) {
    await this.prisma.userRole.deleteMany({ where: { id: userRoleId, userId } });
    return this.findOne(userId);
  }
}
