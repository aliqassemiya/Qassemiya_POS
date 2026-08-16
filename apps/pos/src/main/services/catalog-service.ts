import { getDb } from "../db";
import { getApiClient } from "../api-client";
import { syncWorker } from "../sync/sync-worker";

export interface VariantSearchResult {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  color: string | null;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  imageUrl: string | null;
  quantityOnHand: number | null;
}

async function attachInventory(
  branchId: string | null,
  rows: Array<{
    id: string;
    productId: string;
    productName: string;
    sku: string;
    barcode: string | null;
    size: string | null;
    color: string | null;
    costPrice: number;
    sellingPrice: number;
    taxRate: number;
    imageUrl: string | null;
  }>,
): Promise<VariantSearchResult[]> {
  const db = getDb();
  if (!branchId || rows.length === 0) {
    return rows.map((r) => ({ ...r, quantityOnHand: null }));
  }
  const inv = await db
    .selectFrom("inventory")
    .select(["productVariantId", "quantityOnHand"])
    .where("branchId", "=", branchId)
    .where(
      "productVariantId",
      "in",
      rows.map((r) => r.id),
    )
    .execute();
  const invMap = new Map(inv.map((i) => [i.productVariantId, i.quantityOnHand]));
  return rows.map((r) => ({ ...r, quantityOnHand: invMap.get(r.id) ?? null }));
}

export async function searchVariants(query: string, branchId: string | null, limit = 25): Promise<VariantSearchResult[]> {
  const db = getDb();
  const like = `%${query}%`;
  const rows = await db
    .selectFrom("productVariant as pv")
    .innerJoin("product as p", "p.id", "pv.productId")
    .select([
      "pv.id as id",
      "pv.productId as productId",
      "p.name as productName",
      "pv.sku as sku",
      "pv.barcode as barcode",
      "pv.size as size",
      "pv.color as color",
      "pv.costPrice as costPrice",
      "pv.sellingPrice as sellingPrice",
      "pv.taxRate as taxRate",
      "p.imageUrl as imageUrl",
    ])
    .where((eb) => eb.or([eb("pv.sku", "like", like), eb("pv.barcode", "like", like), eb("p.name", "like", like)]))
    .limit(limit)
    .execute();
  return attachInventory(branchId, rows);
}

export async function lookupByBarcode(barcode: string, branchId: string | null): Promise<VariantSearchResult | null> {
  const db = getDb();
  const local = await db
    .selectFrom("productVariant as pv")
    .innerJoin("product as p", "p.id", "pv.productId")
    .select([
      "pv.id as id",
      "pv.productId as productId",
      "p.name as productName",
      "pv.sku as sku",
      "pv.barcode as barcode",
      "pv.size as size",
      "pv.color as color",
      "pv.costPrice as costPrice",
      "pv.sellingPrice as sellingPrice",
      "pv.taxRate as taxRate",
      "p.imageUrl as imageUrl",
    ])
    .where("pv.barcode", "=", barcode)
    .executeTakeFirst();

  if (local) {
    const [result] = await attachInventory(branchId, [local]);
    return result;
  }

  // Not in local cache — try the live barcode lookup endpoint if we're online.
  if (!syncWorker.isOnline()) return null;
  try {
    const client = getApiClient();
    const { data } = await client.get(`/variants/barcode/${encodeURIComponent(barcode)}`);
    if (!data?.id) return null;
    return {
      id: data.id,
      productId: data.productId ?? data.product?.id ?? "",
      productName: data.product?.name ?? data.productName ?? "",
      sku: data.sku,
      barcode: data.barcode ?? barcode,
      size: data.size ?? null,
      color: data.color ?? null,
      costPrice: Number(data.costPrice ?? 0),
      sellingPrice: Number(data.sellingPrice ?? 0),
      taxRate: Number(data.taxRate ?? 0),
      imageUrl: data.imageUrl ?? null,
      quantityOnHand: null,
    };
  } catch {
    return null;
  }
}

export async function listCategories() {
  return getDb().selectFrom("category").selectAll().orderBy("name", "asc").execute();
}

export async function listPaymentMethods() {
  return getDb().selectFrom("paymentMethod").selectAll().where("isActive", "=", 1).orderBy("name", "asc").execute();
}

export interface CreateCustomerInput {
  fullName: string;
  phone: string;
  email?: string;
}

/**
 * Customer is a read-cache table locally (per the offline-sync design —
 * only Order/Return/StockMovement originate offline), so creating a new
 * customer requires connectivity: it's written through the live API first
 * (so phone-uniqueness is enforced against the single source of truth),
 * then immediately upserted into the local cache so it's usable in the
 * same checkout without waiting for the next catalog pull.
 */
export async function createCustomer(input: CreateCustomerInput) {
  if (!syncWorker.isOnline()) {
    throw new Error("Adding a new customer requires an internet connection");
  }
  const client = getApiClient();
  const { data } = await client.post("/customers", {
    fullName: input.fullName,
    phone: input.phone,
    email: input.email || undefined,
  });

  await getDb()
    .insertInto("customer")
    .values({ id: data.id, name: data.fullName, phone: data.phone ?? null, email: data.email ?? null, updatedAt: data.updatedAt ?? new Date().toISOString() })
    .onConflict((oc) =>
      oc.column("id").doUpdateSet({ name: data.fullName, phone: data.phone ?? null, email: data.email ?? null }),
    )
    .execute();

  return { id: data.id as string, name: data.fullName as string, phone: (data.phone ?? null) as string | null };
}

export async function searchCustomers(query: string, limit = 20) {
  const like = `%${query}%`;
  return getDb()
    .selectFrom("customer")
    .selectAll()
    .where((eb) => eb.or([eb("name", "like", like), eb("phone", "like", like), eb("email", "like", like)]))
    .limit(limit)
    .execute();
}
