import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import type { CreateCustomerDto, CustomerListQueryDto, UpdateCustomerDto } from "./customers.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CustomerListQueryDto) {
    const where = query.search
      ? { OR: [{ fullName: { contains: query.search, mode: "insensitive" as const } }, { phone: { contains: query.search } }] }
      : undefined;

    const [data, totalCount] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { fullName: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { data, totalCount };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException("Customer not found");
    return customer;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: { id: newId(), ...dto } });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }
}
