import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import type { CreateVendorDto, UpdateVendorDto, VendorListQueryDto } from "./vendors.dto";

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: VendorListQueryDto) {
    return this.prisma.vendor.findMany({
      where: {
        ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: "insensitive" as const } },
                { code: { contains: query.search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException("Vendor not found");
    return vendor;
  }

  async create(dto: CreateVendorDto) {
    const existing = await this.prisma.vendor.findFirst({
      where: { OR: [{ code: dto.code }, { numericCode: dto.numericCode }] },
    });
    if (existing) throw new ConflictException("Vendor with this code or numericCode already exists");

    return this.prisma.vendor.create({ data: { id: newId(), ...dto } });
  }

  async update(id: string, dto: UpdateVendorDto) {
    await this.findOne(id);
    return this.prisma.vendor.update({ where: { id }, data: dto });
  }

  /** Chronological invoices + payments + return credits ledger with a running balance. */
  async statement(id: string) {
    await this.findOne(id);

    const [invoices, payments, returns] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({ where: { vendorId: id } }),
      this.prisma.vendorPayment.findMany({ where: { vendorId: id } }),
      this.prisma.purchaseReturn.findMany({ where: { purchaseOrder: { vendorId: id } } }),
    ]);

    type Entry = {
      date: Date;
      type: "INVOICE" | "PAYMENT" | "PURCHASE_RETURN";
      referenceId: string;
      description: string;
      amount: number; // positive increases the amount owed, negative decreases it
    };

    const entries: Entry[] = [
      ...invoices.map((inv) => ({
        date: inv.invoiceDate,
        type: "INVOICE" as const,
        referenceId: inv.id,
        description: `Invoice ${inv.invoiceNumber}`,
        amount: Number(inv.total),
      })),
      ...payments.map((p) => ({
        date: p.paidAt,
        type: "PAYMENT" as const,
        referenceId: p.id,
        description: "Payment",
        amount: -Number(p.amount),
      })),
      ...returns.map((r) => ({
        date: r.createdAt,
        type: "PURCHASE_RETURN" as const,
        referenceId: r.id,
        description: "Purchase return credit",
        amount: -Number(r.totalCreditAmount),
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    return entries.map((e) => {
      balance += e.amount;
      return { ...e, balance };
    });
  }
}
