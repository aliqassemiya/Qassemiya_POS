import type { SyncPushResponse, SyncBundleStatus } from "@qassemiya/shared-types";
import { getDb } from "../db";
import { getMeta, setMeta, LocalMetaKey } from "../db/local-meta";
import { getApiClient, primeApiUrlCache, getCachedApiUrl } from "../api-client";
import { ConnectivityMonitor } from "./connectivity";
import { buildSaleBundle, buildReturnBundle, buildShopifyReturnBundle } from "./build-bundle";
import { backfillOrderNumbers } from "../services/sales-service";
import type { SyncCatalogResponse } from "./catalog-types";

const POLL_INTERVAL_MS = 15_000;
const CATALOG_INTERVAL_MS = 60_000;
const MAX_BUNDLES_PER_PUSH = 50;
const MAX_BACKOFF_MS = 5 * 60_000;

interface PendingRef {
  kind: "SALE" | "RETURN" | "SHOPIFY_RETURN";
  id: string;
}

export interface SyncStatus {
  online: boolean;
  unsyncedCount: number;
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

export type SyncStatusListener = (status: SyncStatus) => void;

export class SyncWorker {
  private connectivity: ConnectivityMonitor;
  private pushTimer: ReturnType<typeof setInterval> | null = null;
  private catalogTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;
  private nextAttemptAt = new Map<string, number>(); // in-memory backoff, keyed "SALE:<id>" / "RETURN:<id>"
  private statusListeners = new Set<SyncStatusListener>();

  constructor() {
    this.connectivity = new ConnectivityMonitor(() => getCachedApiUrl(), POLL_INTERVAL_MS);
    this.connectivity.onChange((online) => {
      this.emitStatus();
      if (online) {
        void this.pushPending();
        void this.pullCatalog();
      }
    });
  }

  onStatusChange(listener: SyncStatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  async start(): Promise<void> {
    await primeApiUrlCache();
    // Must resolve the first connectivity check before the initial pull/push
    // below — ConnectivityMonitor.start() fires its check() without waiting
    // for it, so isOnline() would still read its `false` default here and
    // silently no-op the very first catalog pull on every app boot (the
    // subsequent onChange(online) firing above then covers it once the
    // check resolves, but that was leaving catalog data stale until the
    // 60s interval timer, or until an unrelated online transition).
    await this.connectivity.check();
    this.connectivity.start();

    this.pushTimer = setInterval(() => void this.pushPending(), POLL_INTERVAL_MS);
    this.catalogTimer = setInterval(() => void this.pullCatalog(), CATALOG_INTERVAL_MS);

    // Kick off immediately on start rather than waiting for the first interval tick.
    void this.pushPending();
    void this.pullCatalog();
  }

  stop(): void {
    this.connectivity.stop();
    if (this.pushTimer) clearInterval(this.pushTimer);
    if (this.catalogTimer) clearInterval(this.catalogTimer);
    this.pushTimer = null;
    this.catalogTimer = null;
  }

  isOnline(): boolean {
    return this.connectivity.isOnline();
  }

  /** Called right after checkout so a sale attempts to sync immediately instead of waiting for the next poll tick. */
  notifyNewOrder(): void {
    void this.pushPending();
  }

  async getUnsyncedCount(): Promise<number> {
    const db = getDb();
    const [{ orders }, { returns }, { shopifyReturns }] = await Promise.all([
      db
        .selectFrom("order")
        .select((eb) => eb.fn.countAll<number>().as("orders"))
        .where("syncedAt", "is", null)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom("return")
        .select((eb) => eb.fn.countAll<number>().as("returns"))
        .where("syncedAt", "is", null)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom("shopifyReturn")
        .select((eb) => eb.fn.countAll<number>().as("shopifyReturns"))
        .where("syncedAt", "is", null)
        .executeTakeFirstOrThrow(),
    ]);
    return Number(orders) + Number(returns) + Number(shopifyReturns);
  }

  async getStatus(): Promise<SyncStatus> {
    return {
      online: this.isOnline(),
      unsyncedCount: await this.getUnsyncedCount(),
      isSyncing: this.isSyncing,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
    };
  }

  /**
   * Emitting status to the renderer is inherently best-effort — a listener
   * throwing (e.g. IPC send to a destroyed BrowserWindow) must never
   * propagate out of here. It once did: pushPending() sets isSyncing=true
   * and calls this BEFORE its own try/finally, so an uncaught throw here
   * left isSyncing stuck true forever, silently disabling every future sync
   * attempt for the rest of the process's life (the `if (isSyncing) return`
   * guard at the top of pushPending never got a chance to reset).
   */
  private async emitStatus(): Promise<void> {
    let status: SyncStatus;
    try {
      status = await this.getStatus();
    } catch {
      return;
    }
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch {
        // Best-effort notification — a listener failing (e.g. destroyed window) must not affect sync state.
      }
    }
  }

  async pushPending(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.connectivity.isOnline()) {
      const stillOnline = await this.connectivity.check();
      if (!stillOnline) return;
    }

    const deviceUuid = await getMeta(LocalMetaKey.DEVICE_UUID);
    if (!deviceUuid) return;

    this.isSyncing = true;
    await this.emitStatus();
    try {
      const db = getDb();
      const now = Date.now();

      const unsyncedOrders = await db
        .selectFrom("order")
        .select(["id"])
        .where("syncedAt", "is", null)
        .orderBy("createdAt", "asc")
        .execute();
      const unsyncedReturns = await db
        .selectFrom("return")
        .select(["id"])
        .where("syncedAt", "is", null)
        .orderBy("createdAt", "asc")
        .execute();
      const unsyncedShopifyReturns = await db
        .selectFrom("shopifyReturn")
        .select(["id"])
        .where("syncedAt", "is", null)
        .orderBy("createdAt", "asc")
        .execute();

      const refs: PendingRef[] = [
        ...unsyncedOrders.map((o) => ({ kind: "SALE" as const, id: o.id })),
        ...unsyncedReturns.map((r) => ({ kind: "RETURN" as const, id: r.id })),
        ...unsyncedShopifyReturns.map((r) => ({ kind: "SHOPIFY_RETURN" as const, id: r.id })),
      ].filter((ref) => {
        const nextAt = this.nextAttemptAt.get(`${ref.kind}:${ref.id}`);
        return !nextAt || nextAt <= now;
      });

      if (refs.length === 0) {
        this.lastError = null;
        return;
      }

      const batch = refs.slice(0, MAX_BUNDLES_PER_PUSH);
      const bundles = (
        await Promise.all(
          batch.map((ref) =>
            ref.kind === "SALE" ? buildSaleBundle(ref.id) : ref.kind === "RETURN" ? buildReturnBundle(ref.id) : buildShopifyReturnBundle(ref.id),
          ),
        )
      ).filter((b): b is NonNullable<typeof b> => b !== null);

      if (bundles.length === 0) return;

      const client = getApiClient();
      const response = await client.post<SyncPushResponse>("/sync/push", { deviceUuid, bundles });

      for (const result of response.data.results) {
        await this.applyResult(result.id, result.status, result.error ?? null, result.orderNumber ?? null);
      }
      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      // Network/server error for the whole batch: back off every order we attempted this round.
      // (Per-bundle ERROR results are handled individually in applyResult.)
    } finally {
      this.isSyncing = false;
      await this.emitStatus();
    }
  }

  private async applyResult(id: string, status: SyncBundleStatus, error: string | null, orderNumber: string | null = null): Promise<void> {
    const db = getDb();
    const nowIso = new Date().toISOString();

    if (status === "ACCEPTED" || status === "ALREADY_EXISTS") {
      this.nextAttemptAt.delete(`SALE:${id}`);
      this.nextAttemptAt.delete(`RETURN:${id}`);
      this.nextAttemptAt.delete(`SHOPIFY_RETURN:${id}`);
      const orderUpdate = await db
        .updateTable("order")
        .set({ syncedAt: nowIso, lastSyncError: null, ...(orderNumber ? { orderNumber } : {}) })
        .where("id", "=", id)
        .where("syncedAt", "is", null)
        .executeTakeFirst();
      if (Number(orderUpdate.numUpdatedRows) > 0) return;

      const returnUpdate = await db
        .updateTable("return")
        .set({ syncedAt: nowIso, lastSyncError: null })
        .where("id", "=", id)
        .where("syncedAt", "is", null)
        .executeTakeFirst();
      if (Number(returnUpdate.numUpdatedRows) > 0) return;

      await db
        .updateTable("shopifyReturn")
        .set({ syncedAt: nowIso, lastSyncError: null })
        .where("id", "=", id)
        .where("syncedAt", "is", null)
        .execute();
      return;
    }

    // ERROR: bump attempt count + schedule exponential backoff, never touch the local sale itself.
    const orderRow = await db.selectFrom("order").select(["syncAttempts"]).where("id", "=", id).executeTakeFirst();
    if (orderRow) {
      const attempts = orderRow.syncAttempts + 1;
      const backoffMs = Math.min(POLL_INTERVAL_MS * 2 ** attempts, MAX_BACKOFF_MS);
      this.nextAttemptAt.set(`SALE:${id}`, Date.now() + backoffMs);
      await db
        .updateTable("order")
        .set({ syncAttempts: attempts, lastSyncError: error ?? "sync error" })
        .where("id", "=", id)
        .execute();
      return;
    }

    const returnRow = await db.selectFrom("return").select(["syncAttempts"]).where("id", "=", id).executeTakeFirst();
    if (returnRow) {
      const attempts = returnRow.syncAttempts + 1;
      const backoffMs = Math.min(POLL_INTERVAL_MS * 2 ** attempts, MAX_BACKOFF_MS);
      this.nextAttemptAt.set(`RETURN:${id}`, Date.now() + backoffMs);
      await db
        .updateTable("return")
        .set({ syncAttempts: attempts, lastSyncError: error ?? "sync error" })
        .where("id", "=", id)
        .execute();
      return;
    }

    const shopifyReturnRow = await db
      .selectFrom("shopifyReturn")
      .select(["syncAttempts"])
      .where("id", "=", id)
      .executeTakeFirst();
    const attempts = (shopifyReturnRow?.syncAttempts ?? 0) + 1;
    const backoffMs = Math.min(POLL_INTERVAL_MS * 2 ** attempts, MAX_BACKOFF_MS);
    this.nextAttemptAt.set(`SHOPIFY_RETURN:${id}`, Date.now() + backoffMs);
    await db
      .updateTable("shopifyReturn")
      .set({ syncAttempts: attempts, lastSyncError: error ?? "sync error" })
      .where("id", "=", id)
      .execute();
  }

  async pullCatalog(): Promise<void> {
    if (!this.connectivity.isOnline()) return;
    const branchId = await getMeta(LocalMetaKey.BRANCH_ID);
    if (!branchId) return;

    try {
      const since = await getMeta(LocalMetaKey.LAST_CATALOG_SYNC_AT);
      const shopifySince = await getMeta(LocalMetaKey.LAST_SHOPIFY_CATALOG_SYNC_AT);
      const client = getApiClient();
      const response = await client.get<SyncCatalogResponse>("/sync/catalog", {
        params: { branchId, since: since ?? undefined, shopifySince: shopifySince ?? undefined },
      });
      await this.applyCatalog(response.data);
      const serverTime = response.data.serverTime ?? new Date().toISOString();
      await setMeta(LocalMetaKey.LAST_CATALOG_SYNC_AT, serverTime);
      await setMeta(LocalMetaKey.LAST_SHOPIFY_CATALOG_SYNC_AT, serverTime);
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
    }

    // Piggybacks on the same interval -- cheap, best-effort, and harmless to
    // skip a tick if it fails (see backfillOrderNumbers's own try/catch).
    await backfillOrderNumbers();
  }

  private async applyCatalog(data: SyncCatalogResponse): Promise<void> {
    const db = getDb();
    await db.transaction().execute(async (trx) => {
      for (const c of data.categories ?? []) {
        await trx
          .insertInto("category")
          .values({ id: c.id, name: c.name, nameAr: c.nameAr ?? null, parentId: c.parentId ?? null, updatedAt: c.updatedAt })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({ name: c.name, nameAr: c.nameAr ?? null, parentId: c.parentId ?? null, updatedAt: c.updatedAt }),
          )
          .execute();
      }
      for (const p of data.products ?? []) {
        await trx
          .insertInto("product")
          .values({
            id: p.id,
            name: p.name,
            nameAr: p.nameAr ?? null,
            description: p.description ?? null,
            categoryId: p.categoryId ?? null,
            brand: p.brand ?? null,
            imageUrl: p.imageUrl ?? null,
            updatedAt: p.updatedAt,
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              name: p.name,
              nameAr: p.nameAr ?? null,
              description: p.description ?? null,
              categoryId: p.categoryId ?? null,
              brand: p.brand ?? null,
              imageUrl: p.imageUrl ?? null,
              updatedAt: p.updatedAt,
            }),
          )
          .execute();
      }
      for (const v of data.variants ?? []) {
        await trx
          .insertInto("productVariant")
          .values({
            id: v.id,
            productId: v.productId,
            sku: v.sku,
            barcode: v.barcode ?? null,
            barcodeType: v.barcodeType ?? null,
            size: v.size ?? null,
            color: v.color ?? null,
            colorHex: v.colorHex ?? null,
            costPrice: v.costPrice,
            sellingPrice: v.sellingPrice,
            compareAtPrice: v.compareAtPrice ?? null,
            taxRate: v.taxRate,
            updatedAt: v.updatedAt,
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              productId: v.productId,
              sku: v.sku,
              barcode: v.barcode ?? null,
              barcodeType: v.barcodeType ?? null,
              size: v.size ?? null,
              color: v.color ?? null,
              colorHex: v.colorHex ?? null,
              costPrice: v.costPrice,
              sellingPrice: v.sellingPrice,
              compareAtPrice: v.compareAtPrice ?? null,
              taxRate: v.taxRate,
              updatedAt: v.updatedAt,
            }),
          )
          .execute();
      }
      for (const i of data.inventory ?? []) {
        // Conflict target is the (branchId, productVariantId) natural key,
        // matching the server's own @@unique — not `id`. The server only
        // ever assigns a fresh id the first time a branch+variant pair gets
        // an inventory row; if that row is ever deleted and recreated
        // server-side (e.g. a manual data fix), its id changes even though
        // the branch+variant identity doesn't — conflicting on `id` would
        // then try to INSERT a second row for the same natural key and hit
        // the local UNIQUE(branch_id, product_variant_id) constraint,
        // failing (and rolling back) the entire catalog pull transaction.
        await trx
          .insertInto("inventory")
          .values({
            id: i.id,
            branchId: i.branchId,
            productVariantId: i.productVariantId,
            quantityOnHand: i.quantityOnHand,
            updatedAt: i.updatedAt,
          })
          .onConflict((oc) =>
            oc
              .columns(["branchId", "productVariantId"])
              .doUpdateSet({ id: i.id, quantityOnHand: i.quantityOnHand, updatedAt: i.updatedAt }),
          )
          .execute();
      }
      for (const c of data.customers ?? []) {
        await trx
          .insertInto("customer")
          .values({ id: c.id, name: c.name, phone: c.phone ?? null, email: c.email ?? null, updatedAt: c.updatedAt })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({ name: c.name, phone: c.phone ?? null, email: c.email ?? null, updatedAt: c.updatedAt }),
          )
          .execute();
      }
      for (const pm of data.paymentMethods ?? []) {
        await trx
          .insertInto("paymentMethod")
          .values({ id: pm.id, code: pm.code, name: pm.name, isActive: pm.isActive ? 1 : 0, updatedAt: pm.updatedAt })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({ code: pm.code, name: pm.name, isActive: pm.isActive ? 1 : 0, updatedAt: pm.updatedAt }),
          )
          .execute();
      }
      for (const e of data.employees ?? []) {
        await trx
          .insertInto("employee")
          .values({ id: e.id, employeeCode: e.employeeCode, fullName: e.fullName, branchId: e.branchId, updatedAt: e.updatedAt })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({ employeeCode: e.employeeCode, fullName: e.fullName, branchId: e.branchId, updatedAt: e.updatedAt }),
          )
          .execute();
      }
      for (const o of data.shopifyOrders ?? []) {
        await trx
          .insertInto("shopifyOrder")
          .values({
            id: o.id,
            orderNumber: o.orderNumber,
            shopifyCreatedAt: o.shopifyCreatedAt,
            currentTotalPrice: o.currentTotalPrice,
            currency: o.currency,
            customerName: o.customerName ?? null,
            customerPhone: o.customerPhone ?? null,
            updatedAt: o.updatedAt,
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              orderNumber: o.orderNumber,
              shopifyCreatedAt: o.shopifyCreatedAt,
              currentTotalPrice: o.currentTotalPrice,
              currency: o.currency,
              customerName: o.customerName ?? null,
              customerPhone: o.customerPhone ?? null,
              updatedAt: o.updatedAt,
            }),
          )
          .execute();
      }
      for (const i of data.shopifyOrderItems ?? []) {
        await trx
          .insertInto("shopifyOrderItem")
          .values({
            id: i.id,
            shopifyOrderId: i.shopifyOrderId,
            sku: i.sku ?? null,
            title: i.title,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
            productVariantId: i.productVariantId ?? null,
          })
          .onConflict((oc) =>
            oc.column("id").doUpdateSet({
              shopifyOrderId: i.shopifyOrderId,
              sku: i.sku ?? null,
              title: i.title,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              lineTotal: i.lineTotal,
              productVariantId: i.productVariantId ?? null,
            }),
          )
          .execute();
      }
    });
  }
}

export const syncWorker = new SyncWorker();
