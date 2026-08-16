import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import type { CreateBranchDto, UpdateBranchDto } from "./branches.dto";

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.branch.findMany({ orderBy: { name: "asc" } });
  }

  /** Minimal, unauthenticated projection for the POS pairing screen (runs before any login exists). */
  findPublicList() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException("Branch not found");
    return branch;
  }

  create(dto: CreateBranchDto) {
    return this.prisma.branch.create({ data: { id: newId(), ...dto } });
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: dto });
  }
}
