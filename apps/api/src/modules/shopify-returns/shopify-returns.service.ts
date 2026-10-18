import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { PdfRendererService } from "../../common/pdf/pdf-renderer.service";
import { newId } from "../../common/utils/uuid";
import { buildShopifyReturnSlipHtml } from "./shopify-return-slip-template";
import type { CreateShopifyReturnInput } from "@qassemiya/shared-types";
import type { ShopifyReturnsListQueryDto } from "./shopify-returns.dto";

const WITH_DETAILS = {
  items: { include: { shopifyOrderItem: true } },
  shopifyOrder: { select: { orderNumber: true } },
} as const;

@Injectable()
export class ShopifyReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfRenderer: PdfRendererService,
  ) {}

  async findAll(query: ShopifyReturnsListQueryDto) {
    const where = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.shopifyOrderId ? { shopifyOrderId: query.shopifyOrderId } : {}),
    };
    const [data, totalCount] = await Promise.all([
      this.prisma.shopifyReturn.findMany({
        where,
        include: WITH_DETAILS,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.shopifyReturn.count({ where }),
    ]);
    return { data, totalCount };
  }

  async findOne(id: string) {
    const ret = await this.prisma.shopifyReturn.findUnique({ where: { id }, include: WITH_DETAILS });
    if (!ret) throw new NotFoundException("Shopify return not found");
    return ret;
  }

  async create(dto: CreateShopifyReturnInput) {
    const existing = await this.prisma.shopifyReturn.findUnique({ where: { id: dto.id } });
    if (existing) throw new ConflictException("Shopify return with this id already exists");

    const order = await this.prisma.shopifyOrder.findUnique({ where: { id: dto.shopifyOrderId } });
    if (!order) throw new NotFoundException("Shopify order not found");

    await this.createShopifyReturnTx(dto);
    return this.findOne(dto.id);
  }

  /**
   * No applyStockMovement, no postJournalEntry, no order-status recompute —
   * unlike ReturnsService.createReturnTx, this never touches inventory or the
   * GL (online stock/refunds are Shopify's responsibility, and the original
   * online sale was never booked into this system's ledger either). Purely a
   * validated log entry, with the validation itself being the only real work:
   * each item's quantity can't exceed what hasn't already been returned.
   */
  async createShopifyReturnTx(input: CreateShopifyReturnInput) {
    await this.prisma.$transaction(async (tx) => {
      const orderItems = await tx.shopifyOrderItem.findMany({
        where: { id: { in: input.items.map((i) => i.shopifyOrderItemId) } },
      });
      const orderItemMap = new Map(orderItems.map((i) => [i.id, i]));

      const alreadyReturned = await tx.shopifyReturnItem.groupBy({
        by: ["shopifyOrderItemId"],
        where: { shopifyOrderItemId: { in: input.items.map((i) => i.shopifyOrderItemId) } },
        _sum: { quantity: true },
      });
      const returnedMap = new Map(alreadyReturned.map((r) => [r.shopifyOrderItemId, r._sum.quantity ?? 0]));

      for (const item of input.items) {
        const orderItem = orderItemMap.get(item.shopifyOrderItemId);
        if (!orderItem) throw new NotFoundException(`Shopify order item ${item.shopifyOrderItemId} not found`);
        const already = returnedMap.get(item.shopifyOrderItemId) ?? 0;
        if (item.quantity > orderItem.quantity - already) {
          throw new ConflictException(`Return quantity exceeds remaining returnable quantity for item ${item.shopifyOrderItemId}`);
        }
      }

      await tx.shopifyReturn.create({
        data: {
          id: input.id,
          shopifyOrderId: input.shopifyOrderId,
          branchId: input.branchId,
          processedByUserId: input.processedByUserId,
          reason: input.reason,
          items: {
            create: input.items.map((item) => ({
              id: newId(),
              shopifyOrderItemId: item.shopifyOrderItemId,
              quantity: item.quantity,
            })),
          },
        },
      });
    });
  }

  /**
   * Builds the same slip content printer-bridge.ts's printReturnSlip prints
   * on the till's thermal printer, as a viewable/downloadable web page +
   * PDF — for testing without a physical printer, and for anyone who later
   * needs to re-pull a copy (e.g. to process the Shopify-side refund).
   */
  private async getReturnForSlip(id: string) {
    const ret = await this.prisma.shopifyReturn.findUnique({
      where: { id },
      include: {
        items: { include: { shopifyOrderItem: true } },
        shopifyOrder: { select: { orderNumber: true, customerName: true, customerPhone: true } },
        branch: { select: { name: true, nameAr: true } },
        processedByUser: { select: { fullName: true } },
      },
    });
    if (!ret) throw new NotFoundException("Shopify return not found");

    return {
      id: ret.id,
      shopifyOrderNumber: ret.shopifyOrder.orderNumber,
      createdAt: ret.createdAt,
      branchName: ret.branch.name,
      branchNameAr: ret.branch.nameAr,
      processedByName: ret.processedByUser.fullName,
      customerName: ret.shopifyOrder.customerName,
      customerPhone: ret.shopifyOrder.customerPhone,
      reason: ret.reason,
      items: ret.items.map((item) => ({
        title: item.shopifyOrderItem.title,
        sku: item.shopifyOrderItem.sku,
        quantity: item.quantity,
      })),
    };
  }

  async renderSlipHtml(id: string): Promise<string> {
    const slip = await this.getReturnForSlip(id);
    return buildShopifyReturnSlipHtml(slip);
  }

  async renderSlipPdf(id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const slip = await this.getReturnForSlip(id);
    const html = buildShopifyReturnSlipHtml(slip);
    const buffer = await this.pdfRenderer.renderHtmlToPdf(html, { emulatePrint: true });
    return { buffer, fileName: `online-return-${slip.shopifyOrderNumber.replace(/[^\w-]/g, "")}.pdf` };
  }

  /** Attaches alreadyReturned per item to a ShopifyOrder-with-items payload — for the Online Orders page (follow-up). */
  async attachAlreadyReturned<T extends { id: string; items: Array<{ id: string }> }>(order: T) {
    const returnItems = await this.prisma.shopifyReturnItem.findMany({
      where: { shopifyOrderItem: { shopifyOrderId: order.id } },
      select: { shopifyOrderItemId: true, quantity: true },
    });
    const map = new Map<string, number>();
    for (const ri of returnItems) map.set(ri.shopifyOrderItemId, (map.get(ri.shopifyOrderItemId) ?? 0) + ri.quantity);
    return { ...order, items: order.items.map((i) => ({ ...i, alreadyReturned: map.get(i.id) ?? 0 })) };
  }
}
