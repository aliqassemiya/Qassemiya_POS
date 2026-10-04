import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import { RIYADH_OFFSET_MS, startOfDayRiyadh, endOfDayRiyadh } from "../../common/utils/date-range";
import { decryptToken, encryptToken } from "../../common/crypto/token-cipher";
import { ShopifyClient, type ShopifyRawLineItem, type ShopifyRawOrder } from "./shopify-client";
import type { Prisma } from "../../../generated/prisma";
import type { TestShopifyConnectionDto, UpsertShopifyIntegrationDto, ShopifyOrderListQueryDto } from "./shopify.dto";

const DEFAULT_API_VERSION = "2024-10";
const OVERLAP_LOCK_STALE_MS = 15 * 60 * 1000;
const CURSOR_OVERLAP_BUFFER_MS = 2 * 60 * 1000;
const TOKEN_ENC_KEY_VAR = "SHOPIFY_TOKEN_ENC_KEY";

/**
 * 1st of the current month at Riyadh-local midnight — computed via a fixed
 * UTC+3 offset rather than the server process's own configured timezone, so
 * the backfill boundary is correct regardless of where this ends up
 * deployed (same fixed-offset idea that fixed the dashboard's sales-trend
 * day-bucketing bug in reports.service.ts, but not dependent on the
 * server's local TZ setting at all here).
 */
function startOfCurrentMonthRiyadh(): Date {
  const riyadhNow = new Date(Date.now() + RIYADH_OFFSET_MS);
  const startOfMonthAsUtc = Date.UTC(riyadhNow.getUTCFullYear(), riyadhNow.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(startOfMonthAsUtc - RIYADH_OFFSET_MS);
}

function normalizeShopDomain(input: string): string {
  return input.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getIntegrationStatus() {
    const integration = await this.prisma.shopifyIntegration.findFirst();
    if (!integration) return null;
    // Deliberately omit accessTokenCipher/Iv/Tag — write-only from the API's perspective.
    return {
      id: integration.id,
      shopDomain: integration.shopDomain,
      apiVersion: integration.apiVersion,
      isActive: integration.isActive,
      syncFromDate: integration.syncFromDate,
      syncCursor: integration.syncCursor,
      lastSyncedAt: integration.lastSyncedAt,
    };
  }

  async testConnection(dto: TestShopifyConnectionDto) {
    const client = new ShopifyClient(normalizeShopDomain(dto.shopDomain), dto.accessToken, DEFAULT_API_VERSION);
    return client.testConnection();
  }

  async upsertIntegration(dto: UpsertShopifyIntegrationDto) {
    const shopDomain = normalizeShopDomain(dto.shopDomain);
    const existing = await this.prisma.shopifyIntegration.findFirst();

    if (!existing && !dto.accessToken) {
      throw new BadRequestException("Access token is required to connect Shopify for the first time");
    }

    const accessToken =
      dto.accessToken ??
      decryptToken(
        {
          cipher: existing!.accessTokenCipher,
          iv: existing!.accessTokenIv,
          tag: existing!.accessTokenTag,
        },
        TOKEN_ENC_KEY_VAR,
      );

    // Validate before persisting so a bad domain/token combo surfaces
    // immediately in the settings UI instead of failing silently on the
    // next cron tick.
    await new ShopifyClient(shopDomain, accessToken, existing?.apiVersion ?? DEFAULT_API_VERSION).testConnection();

    // Re-encrypting unconditionally (even when dto.accessToken was omitted
    // and accessToken here is just the decrypted existing value) is
    // harmless — a fresh IV each save, same plaintext underneath — and
    // keeps the create/update data shapes simple and fully typed.
    const encrypted = encryptToken(accessToken, TOKEN_ENC_KEY_VAR);
    const tokenFields = { accessTokenCipher: encrypted.cipher, accessTokenIv: encrypted.iv, accessTokenTag: encrypted.tag };

    if (existing) {
      await this.prisma.shopifyIntegration.update({
        where: { id: existing.id },
        data: { shopDomain, isActive: dto.isActive ?? existing.isActive, ...tokenFields },
      });
    } else {
      await this.prisma.shopifyIntegration.create({
        data: {
          id: newId(),
          shopDomain,
          isActive: dto.isActive ?? true,
          syncFromDate: startOfCurrentMonthRiyadh(),
          ...tokenFields,
        },
      });
    }
    return this.getIntegrationStatus();
  }

  async getSyncLogs() {
    return this.prisma.shopifySyncLog.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
  }

  async getSyncLogEntries(syncLogId: string) {
    const log = await this.prisma.shopifySyncLog.findUnique({ where: { id: syncLogId } });
    if (!log) throw new NotFoundException("Sync log not found");
    return this.prisma.shopifySyncLogEntry.findMany({
      where: { syncLogId },
      orderBy: { orderNumber: "asc" },
    });
  }

  async findOrders(query: ShopifyOrderListQueryDto) {
    const search = query.search?.trim();
    const where = {
      ...(query.from || query.to
        ? {
            shopifyCreatedAt: {
              ...(query.from ? { gte: startOfDayRiyadh(query.from) } : {}),
              ...(query.to ? { lte: endOfDayRiyadh(query.to) } : {}),
            },
          }
        : {}),
      ...(query.unmatchedOnly ? { items: { some: { productVariantId: null } } } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(search
        ? {
            OR: [
              { orderNumber: { contains: search, mode: "insensitive" as const } },
              { items: { some: { sku: { contains: search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };

    const [orders, totalCount] = await Promise.all([
      this.prisma.shopifyOrder.findMany({
        where,
        include: { items: true },
        orderBy: { shopifyCreatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.shopifyOrder.count({ where }),
    ]);

    return { orders, totalCount };
  }

  async findOrder(id: string) {
    const order = await this.prisma.shopifyOrder.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException("Shopify order not found");
    return order;
  }

  /** Every 5 minutes, unattended — errors are logged to shopify_sync_logs, never thrown out of a cron tick. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleScheduledSync() {
    try {
      await this.runSync("CRON");
    } catch (err) {
      this.logger.error(`Scheduled Shopify sync failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async runSync(triggeredBy: "CRON" | "MANUAL") {
    const integration = await this.prisma.shopifyIntegration.findFirst();
    if (!integration || !integration.isActive) return { skipped: true, reason: "not configured or inactive" };

    // The most recent IN_PROGRESS row IS the overlap lock — a stale one
    // (older than the timeout) is treated as a crashed run, not a live one.
    const staleThreshold = new Date(Date.now() - OVERLAP_LOCK_STALE_MS);
    const activeRun = await this.prisma.shopifySyncLog.findFirst({
      where: { status: "IN_PROGRESS", startedAt: { gte: staleThreshold } },
      orderBy: { startedAt: "desc" },
    });
    if (activeRun) return { skipped: true, reason: "sync already in progress" };

    const runStart = new Date();
    const cursorFrom = integration.syncCursor ?? integration.syncFromDate;
    const log = await this.prisma.shopifySyncLog.create({
      data: { id: newId(), status: "IN_PROGRESS", triggeredBy, cursorFrom },
    });

    try {
      const accessToken = decryptToken(
        {
          cipher: integration.accessTokenCipher,
          iv: integration.accessTokenIv,
          tag: integration.accessTokenTag,
        },
        TOKEN_ENC_KEY_VAR,
      );
      const client = new ShopifyClient(integration.shopDomain, accessToken, integration.apiVersion);
      const rawOrders = await client.fetchOrdersUpdatedSince(cursorFrom.toISOString());

      const entries: Array<{ orderId: string; orderNumber: string; action: "CREATED" | "UPDATED" }> = [];
      for (const raw of rawOrders) {
        const result = await this.upsertShopifyOrder(raw);
        if (result) entries.push(result);
      }
      const upserted = entries.length;

      if (entries.length > 0) {
        await this.prisma.shopifySyncLogEntry.createMany({
          data: entries.map((e) => ({
            id: newId(),
            syncLogId: log.id,
            shopifyOrderId: e.orderId,
            orderNumber: e.orderNumber,
            action: e.action,
          })),
        });
      }

      await this.rematchUnmatchedItems();

      const newCursor = new Date(runStart.getTime() - CURSOR_OVERLAP_BUFFER_MS);
      await this.prisma.shopifyIntegration.update({
        where: { id: integration.id },
        data: { syncCursor: newCursor, lastSyncedAt: new Date() },
      });
      await this.prisma.shopifySyncLog.update({
        where: { id: log.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          ordersFetched: rawOrders.length,
          ordersUpserted: upserted,
          cursorTo: newCursor,
        },
      });
      return { skipped: false, ordersFetched: rawOrders.length, ordersUpserted: upserted };
    } catch (err) {
      await this.prisma.shopifySyncLog.update({
        where: { id: log.id },
        data: { status: "FAILED", finishedAt: new Date(), errorMessage: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  }

  /**
   * Upserts one Shopify order + its line items. This is the ONE reusable
   * ingestion entrypoint — the polling loop calls it today, a future
   * webhook handler will call it later with zero duplicated logic. Never
   * touches stock_movements/inventory/journal_entries — there is no code
   * path from here into any of those tables.
   */
  async upsertShopifyOrder(
    raw: ShopifyRawOrder,
  ): Promise<{ orderId: string; orderNumber: string; action: "CREATED" | "UPDATED" } | null> {
    const shopifyOrderId = String(raw.id);
    const shopifyUpdatedAt = new Date(raw.updated_at);

    const existing = await this.prisma.shopifyOrder.findUnique({ where: { shopifyOrderId } });
    // Guards against regressing on a re-fetched or (later) out-of-order webhook payload.
    if (existing && existing.shopifyUpdatedAt >= shopifyUpdatedAt) return null;

    const orderId = existing?.id ?? newId();
    const primaryTaxLine = raw.tax_lines?.[0];
    const customerFirstLast = raw.customer
      ? [raw.customer.first_name, raw.customer.last_name].filter(Boolean).join(" ")
      : "";
    const customerName =
      customerFirstLast || raw.shipping_address?.name || raw.billing_address?.name || null;
    const customerPhone =
      raw.phone ||
      raw.customer?.phone ||
      raw.customer?.default_address?.phone ||
      raw.shipping_address?.phone ||
      raw.billing_address?.phone ||
      null;
    const customerEmail = raw.customer?.email ?? null;

    const orderData = {
      shopifyOrderId,
      orderNumber: raw.name,
      shopifyCreatedAt: new Date(raw.created_at),
      shopifyUpdatedAt,
      cancelledAt: raw.cancelled_at ? new Date(raw.cancelled_at) : null,
      financialStatus: raw.financial_status,
      currency: raw.currency,
      totalPrice: Number(raw.total_price),
      currentTotalPrice: Number(raw.current_total_price),
      subtotalPrice: Number(raw.subtotal_price ?? 0),
      totalDiscounts: Number(raw.total_discounts ?? 0),
      discountCodes: raw.discount_codes?.length ? raw.discount_codes.map((d) => d.code).join(", ") : null,
      totalShipping: (raw.shipping_lines ?? []).reduce((sum, line) => sum + Number(line.price ?? 0), 0),
      shippingTitle: raw.shipping_lines?.[0]?.title ?? null,
      totalTax: Number(raw.total_tax ?? 0),
      taxRate: primaryTaxLine?.rate != null ? primaryTaxLine.rate : null,
      taxesIncluded: raw.taxes_included ?? false,
      totalOutstanding: Number(raw.total_outstanding ?? 0),
      customerName,
      customerPhone,
      customerEmail,
      rawPayload: raw as unknown as Prisma.InputJsonValue,
    };

    await this.prisma.$transaction(async (tx) => {
      const customerId = await this.resolveCustomerId(tx, { customerName, customerPhone, customerEmail });

      if (existing) {
        await tx.shopifyOrder.update({ where: { id: orderId }, data: { ...orderData, customerId } });
        // Shopify line-item ids aren't stable across order edits — replace
        // the full set rather than trying to diff/patch individual rows.
        await tx.shopifyOrderItem.deleteMany({ where: { shopifyOrderId: orderId } });
      } else {
        await tx.shopifyOrder.create({ data: { id: orderId, ...orderData, customerId } });
      }

      for (const item of raw.line_items) {
        const productVariantId = await this.matchProductVariant(tx, item);
        const unitPrice = Number(item.price);
        await tx.shopifyOrderItem.create({
          data: {
            id: newId(),
            shopifyOrderId: orderId,
            sku: item.sku,
            title: item.title,
            quantity: item.quantity,
            unitPrice,
            lineTotal: unitPrice * item.quantity,
            productVariantId,
          },
        });
      }
    });

    return { orderId, orderNumber: raw.name, action: existing ? "UPDATED" : "CREATED" };
  }

  /**
   * Never fails or skips an order over an unmatched SKU — tries the faster
   * shopifyVariantId path first (self-healing: gets backfilled below once a
   * SKU match succeeds), falls back to a trimmed, case-insensitive SKU
   * match, and returns null (not an error) when neither hits.
   */
  private async matchProductVariant(
    tx: Prisma.TransactionClient,
    item: ShopifyRawLineItem,
  ): Promise<string | null> {
    if (item.variant_id) {
      const byShopifyId = await tx.productVariant.findUnique({
        where: { shopifyVariantId: String(item.variant_id) },
      });
      if (byShopifyId) return byShopifyId.id;
    }

    const sku = item.sku?.trim();
    if (!sku) return null;

    const bySku = await tx.productVariant.findFirst({ where: { sku: { equals: sku, mode: "insensitive" } } });
    if (!bySku) return null;

    if (item.variant_id && !bySku.shopifyVariantId) {
      // Best-effort backfill so the next sync matches this SKU via the
      // faster id path. Non-fatal: a rare unique-constraint collision here
      // must never fail the order sync itself.
      await tx.productVariant
        .update({ where: { id: bySku.id }, data: { shopifyVariantId: String(item.variant_id) } })
        .catch(() => undefined);
    }
    return bySku.id;
  }

  /**
   * Matches/links a Shopify order to the shared Customer table by phone —
   * the existing unique identifier for customers in this system — so a
   * person who buys both online and in-store is one customer, not two, and
   * appears in the Customers screen automatically. Non-destructive: an
   * existing customer's fullName/email are never overwritten, only filled
   * in if blank. No phone at all (e.g. a guest checkout) means no reliable
   * key to match or dedupe on, so no Customer row is created for it.
   */
  private async resolveCustomerId(
    tx: Prisma.TransactionClient,
    info: { customerName: string | null; customerPhone: string | null; customerEmail: string | null },
  ): Promise<string | null> {
    if (!info.customerPhone) return null;

    const existing = await tx.customer.findUnique({ where: { phone: info.customerPhone } });
    if (existing) {
      const fillIns: Prisma.CustomerUpdateInput = {};
      if (!existing.email && info.customerEmail) fillIns.email = info.customerEmail;
      if (Object.keys(fillIns).length > 0) {
        await tx.customer.update({ where: { id: existing.id }, data: fillIns });
      }
      return existing.id;
    }

    const created = await tx.customer.create({
      data: {
        id: newId(),
        fullName: info.customerName ?? info.customerPhone,
        phone: info.customerPhone,
        email: info.customerEmail,
      },
    });
    return created.id;
  }

  /** Cheap catch-up pass, run at the end of every sync: a SKU added to the POS catalog later gets matched automatically, no separate job needed. */
  private async rematchUnmatchedItems() {
    const unmatched = await this.prisma.shopifyOrderItem.findMany({
      where: { productVariantId: null, sku: { not: null } },
    });
    for (const item of unmatched) {
      const sku = item.sku?.trim();
      if (!sku) continue;
      const variant = await this.prisma.productVariant.findFirst({ where: { sku: { equals: sku, mode: "insensitive" } } });
      if (variant) {
        await this.prisma.shopifyOrderItem.update({ where: { id: item.id }, data: { productVariantId: variant.id } });
      }
    }
  }
}
