import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { RoleName } from "@qassemiya/shared-types";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import type { CreateEmployeeDto, ResetPinDto, UpdateEmployeeDto } from "./employees.dto";

const SELECT = {
  id: true,
  userId: true,
  employeeCode: true,
  fullName: true,
  email: true,
  branchId: true,
  isActive: true,
  createdAt: true,
  branch: true,
} as const;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(branchId?: string) {
    const employees = await this.prisma.employee.findMany({
      where: branchId ? { branchId } : undefined,
      select: SELECT,
      orderBy: { fullName: "asc" },
    });
    return Promise.all(employees.map((e) => this.withRoles(e)));
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id }, select: SELECT });
    if (!employee) throw new NotFoundException("Employee not found");
    return this.withRoles(employee);
  }

  async create(dto: CreateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({ where: { employeeCode: dto.employeeCode } });
    if (existing) throw new ConflictException("Employee code already in use");

    // dto's refine() guarantees pinCode/roles are both-or-neither — no
    // system access at all (sales-attribution only) when neither is given.
    const grantsAccess = Boolean(dto.pinCode && dto.roles?.length);
    const pinCodeHash = grantsAccess ? await argon2.hash(dto.pinCode!) : undefined;
    const userId = grantsAccess ? await this.provisionLoginUser(dto.employeeCode, dto.fullName) : undefined;

    const employee = await this.prisma.employee.create({
      data: {
        id: newId(),
        employeeCode: dto.employeeCode,
        fullName: dto.fullName,
        email: dto.email,
        branchId: dto.branchId,
        userId,
        pinCodeHash,
      },
    });

    if (grantsAccess) {
      await this.replaceRoles(userId!, dto.branchId, dto.roles!);
    }
    return this.findOne(employee.id);
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const current = await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.branchId !== undefined) data.branchId = dto.branchId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // Upgrading a previously no-access employee to have POS login —
    // provision the User + PIN it never had.
    let userId = current.userId;
    if (!userId && dto.pinCode && dto.roles?.length) {
      userId = await this.provisionLoginUser(current.employeeCode, dto.fullName ?? current.fullName);
      data.userId = userId;
      data.pinCodeHash = await argon2.hash(dto.pinCode);
    } else if (userId && dto.pinCode !== undefined) {
      data.pinCodeHash = await argon2.hash(dto.pinCode);
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.employee.update({ where: { id }, data });
    }

    if (dto.roles !== undefined && userId) {
      await this.replaceRoles(userId, dto.branchId ?? current.branchId, dto.roles);
    }
    return this.findOne(id);
  }

  async resetPin(id: string, dto: ResetPinDto) {
    const current = await this.findOne(id);
    if (!current.userId) throw new ConflictException("This employee has no system access to reset a PIN for");
    const pinCodeHash = await argon2.hash(dto.pinCode);
    await this.prisma.employee.update({ where: { id }, data: { pinCodeHash } });
    return { success: true };
  }

  /** Employees authenticate via POS PIN only — this password is never used or surfaced. */
  private async provisionLoginUser(employeeCode: string, fullName: string): Promise<string> {
    const email = `${employeeCode.toLowerCase()}@employees.qassemiya.local`;
    const passwordHash = await argon2.hash(randomBytes(24).toString("hex"));
    const user = await this.prisma.user.create({
      data: { id: newId(), email, fullName, passwordHash },
    });
    return user.id;
  }

  private async replaceRoles(userId: string, branchId: string, roleNames: RoleName[]) {
    const roles = await this.prisma.role.findMany({ where: { name: { in: roleNames } } });
    await this.prisma.userRole.deleteMany({ where: { userId, branchId } });
    await this.prisma.userRole.createMany({
      data: roles.map((role) => ({ id: newId(), userId, roleId: role.id, branchId })),
    });
  }

  private async withRoles<T extends { userId: string | null; branchId: string }>(employee: T) {
    if (!employee.userId) return { ...employee, roles: [] as RoleName[] };
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: employee.userId, OR: [{ branchId: employee.branchId }, { branchId: null }] },
      include: { role: true },
    });
    return { ...employee, roles: userRoles.map((ur) => ur.role.name as RoleName) };
  }
}
