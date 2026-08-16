import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import type { CreatePurchaseOrderDto, PurchaseOrderListQueryDto, UpdatePurchaseOrderDto } from "./purchase-orders.dto";

const WITH_DETAILS = {
  vendor: true,
  branch: true,
  items: { include: { productVariant: { include: { product: true } } } },
} as const;

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PurchaseOrderListQueryDto) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        ...(query.vendorId ? { vendorId: query.vendorId } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: WITH_DETAILS,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
  }

  async findOne(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id }, include: WITH_DETAILS });
    if (!po) throw new NotFoundException("Purchase order not found");
    return po;
  }

  async create(dto: CreatePurchaseOrderDto, userId: string) {
    const id = newId();
    await this.prisma.purchaseOrder.create({
      data: {
        id,
        vendorId: dto.vendorId,
        branchId: dto.branchId,
        createdByUserId: userId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        subtotal: dto.subtotal,
        discountTotal: dto.discountTotal,
        taxTotal: dto.taxTotal,
        total: dto.total,
        notes: dto.notes,
        items: {
          create: dto.items.map((item) => ({
            id: newId(),
            productVariantId: item.productVariantId,
            quantityOrdered: item.quantityOrdered,
            unitCost: item.unitCost,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
          })),
        },
      },
    });
    return this.findOne(id);
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    await this.findOne(id);
    await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...(dto.expectedDate !== undefined ? { expectedDate: new Date(dto.expectedDate) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    return this.findOne(id);
  }

  async submit(id: string) {
    const po = await this.findOne(id);
    if (po.status !== "DRAFT") throw new ConflictException("Only DRAFT purchase orders can be submitted");
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: "SUBMITTED" } });
    return this.findOne(id);
  }

  async cancel(id: string) {
    const po = await this.findOne(id);
    if (po.status === "CANCELLED") throw new ConflictException("Purchase order is already cancelled");
    const anyReceived = po.items.some((item) => item.quantityReceived > 0);
    if (anyReceived) throw new ConflictException("Cannot cancel a purchase order that has already received stock");
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    return this.findOne(id);
  }
}
