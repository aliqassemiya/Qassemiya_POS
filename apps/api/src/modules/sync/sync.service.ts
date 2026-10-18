import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { SalesService } from "../sales/sales.service";
import { ReturnsService } from "../returns/returns.service";
import { ShopifyReturnsService } from "../shopify-returns/shopify-returns.service";
import type { SyncBundle, SyncCatalogQuery, SyncPushRequest, SyncPushResponse, SyncPushResult } from "@qassemiya/shared-types";

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly salesService: SalesService,
    private readonly returnsService: ReturnsService,
    private readonly shopifyReturnsService: ShopifyReturnsService,
  ) {}

  /**
   * Idempotent upsert-by-id per bundle. Each bundle is applied in its own
   * transaction so one bad bundle in a batch of 50 can't roll back the rest.
   * Never rejects for stock reasons — the sale/return already happened
   * offline; a negative resulting balance is an oversell alert for
   * reporting, not a sync failure.
   */
  async push(request: SyncPushRequest): Promise<SyncPushResponse> {
    const device = await this.prisma.device.findUnique({ where: { deviceUuid: request.deviceUuid } });

    const results: SyncPushResult[] = [];
    for (const bundle of request.bundles) {
      results.push(await this.applyBundle(bundle, device?.id));
    }
    return { results };
  }

  private async applyBundle(bundle: SyncBundle, _deviceId?: string): Promise<SyncPushResult> {
    const serverTimestamp = new Date().toISOString();
    const id = bundle.payload.id;

    try {
      if (bundle.kind === "SALE") {
        const existing = await this.prisma.order.findUnique({ where: { id }, select: { orderNumber: true } });
        if (existing) return { id, status: "ALREADY_EXISTS", serverTimestamp, orderNumber: existing.orderNumber };

        const { orderNumber } = await this.salesService.createSaleTx(bundle.payload, new Date(bundle.clientCreatedAt));
        return { id, status: "ACCEPTED", serverTimestamp, orderNumber };
      }

      if (bundle.kind === "RETURN") {
        const existing = await this.prisma.return.findUnique({ where: { id } });
        if (existing) return { id, status: "ALREADY_EXISTS", serverTimestamp };

        await this.returnsService.createReturnTx(bundle.payload);
        return { id, status: "ACCEPTED", serverTimestamp };
      }

      // kind === "SHOPIFY_RETURN"
      const existing = await this.prisma.shopifyReturn.findUnique({ where: { id } });
      if (existing) return { id, status: "ALREADY_EXISTS", serverTimestamp };

      await this.shopifyReturnsService.createShopifyReturnTx(bundle.payload);
      return { id, status: "ACCEPTED", serverTimestamp };
    } catch (err) {
      // Unique constraint race (two pushes landed concurrently) also counts as already-applied.
      if (this.isUniqueConstraintError(err)) {
        return { id, status: "ALREADY_EXISTS", serverTimestamp };
      }
      this.logger.error(`Sync bundle ${id} failed: ${(err as Error).message}`, (err as Error).stack);
      return { id, status: "ERROR", serverTimestamp, error: (err as Error).message };
    }
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
  }

  /**
   * Shaped to match the POS app's local read-cache tables exactly (flat
   * `variants` array, not nested under `products`; `customers[].name`, not
   * `fullName`) — this is a POS-specific projection, distinct from the
   * canonical /products and /customers REST resources the admin web app uses.
   */
  async catalog(query: SyncCatalogQuery) {
    const since = query.since ? new Date(query.since) : undefined;
    const updatedAt = since ? { gt: since } : undefined;
    const shopifySince = query.shopifySince ? new Date(query.shopifySince) : undefined;
    const shopifyUpdatedAt = shopifySince ? { gt: shopifySince } : undefined;

    const [categories, products, inventory, paymentMethods, customers, employees, shopifyOrders] = await Promise.all([
      this.prisma.category.findMany({ where: updatedAt ? { updatedAt } : undefined }),
      this.prisma.product.findMany({
        where: updatedAt ? { OR: [{ updatedAt }, { variants: { some: { updatedAt } } }] } : undefined,
        include: { variants: true },
      }),
      this.prisma.inventory.findMany({
        where: { branchId: query.branchId, ...(updatedAt ? { updatedAt } : {}) },
      }),
      this.prisma.paymentMethod.findMany({ where: { isActive: true } }),
      this.prisma.customer.findMany({ where: updatedAt ? { updatedAt } : undefined }),
      // Scoped to this device's own branch — the salesperson dropdown only
      // ever needs to offer that branch's own staff. isActive:true only:
      // no point caching someone who can no longer be picked.
      this.prisma.employee.findMany({
        where: { branchId: query.branchId, isActive: true, ...(updatedAt ? { updatedAt } : {}) },
      }),
      // NOT branch-filtered — any branch can receive a return for any online
      // order, so every till caches the full set (incrementally, via `since`)
      // for its local offline-capable search.
      this.prisma.shopifyOrder.findMany({
        where: shopifyUpdatedAt ? { updatedAt: shopifyUpdatedAt } : undefined,
        include: { items: true },
      }),
    ]);

    const variants = products.flatMap((p) => p.variants);
    const shopifyOrderItems = shopifyOrders.flatMap((o) =>
      o.items.map((i) => ({
        id: i.id,
        shopifyOrderId: i.shopifyOrderId,
        sku: i.sku,
        title: i.title,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
        productVariantId: i.productVariantId,
      })),
    );

    return {
      serverTime: new Date().toISOString(),
      branchId: query.branchId,
      categories,
      products: products.map(({ variants: _variants, ...product }) => product),
      variants,
      inventory,
      paymentMethods: paymentMethods.map((pm) => ({ ...pm, updatedAt: new Date().toISOString() })),
      customers: customers.map((c) => ({ id: c.id, name: c.fullName, phone: c.phone, email: c.email, updatedAt: c.updatedAt })),
      employees: employees.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        fullName: e.fullName,
        branchId: e.branchId,
        updatedAt: e.updatedAt,
      })),
      // Flat/minimal shape for the till's offline search cache — never ships
      // rawPayload or any of the accounting-comparison-only fields.
      shopifyOrders: shopifyOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        shopifyCreatedAt: o.shopifyCreatedAt,
        currentTotalPrice: o.currentTotalPrice,
        currency: o.currency,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        updatedAt: o.updatedAt,
      })),
      shopifyOrderItems,
    };
  }

  async status(deviceUuid?: string) {
    const device = deviceUuid ? await this.prisma.device.findUnique({ where: { deviceUuid } }) : null;
    return {
      serverTime: new Date().toISOString(),
      ok: true,
      device: device
        ? { id: device.id, name: device.name, branchId: device.branchId, isActive: device.isActive, lastSeenAt: device.lastSeenAt }
        : null,
    };
  }
}
