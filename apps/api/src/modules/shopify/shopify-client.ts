// Thin wrapper around Shopify's Admin REST API using native fetch (Node 20+
// has it built in — no new HTTP dependency needed). Kept behind a small
// interface so a future GraphQL client or webhook payload adapter can slot
// in without touching shopify.service.ts's upsert/matching logic.

export interface ShopifyRawLineItem {
  id: number;
  sku: string | null;
  title: string;
  quantity: number;
  price: string;
  variant_id: number | null;
}

export interface ShopifyRawTaxLine {
  title: string;
  price: string;
  rate: number | null;
}

export interface ShopifyRawDiscountCode {
  code: string;
  amount: string;
}

export interface ShopifyRawShippingLine {
  title: string;
  price: string;
}

export interface ShopifyRawCustomer {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  // Shopify usually leaves customer.phone null even when a phone number
  // exists on the customer's saved address — this is the more reliable
  // source in practice (confirmed against real synced order payloads).
  default_address: { phone: string | null } | null;
}

export interface ShopifyRawAddress {
  name: string | null;
  phone: string | null;
}

export interface ShopifyRawOrder {
  id: number;
  name: string; // "#1001"
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  financial_status: string;
  currency: string;
  phone: string | null;
  total_price: string;
  current_total_price: string;
  subtotal_price: string;
  total_discounts: string;
  total_tax: string;
  total_outstanding: string;
  taxes_included: boolean;
  discount_codes: ShopifyRawDiscountCode[];
  shipping_lines: ShopifyRawShippingLine[];
  tax_lines: ShopifyRawTaxLine[];
  customer: ShopifyRawCustomer | null;
  shipping_address: ShopifyRawAddress | null;
  billing_address: ShopifyRawAddress | null;
  line_items: ShopifyRawLineItem[];
}

export interface ShopifyShopInfo {
  name: string;
  currency: string;
}

const MAX_RETRIES = 3;
const PAGE_LIMIT = 250;

export class ShopifyRequestError extends Error {}

export class ShopifyClient {
  constructor(
    private readonly shopDomain: string,
    private readonly accessToken: string,
    private readonly apiVersion: string,
  ) {}

  private baseUrl(path: string): string {
    return `https://${this.shopDomain}/admin/api/${this.apiVersion}${path}`;
  }

  /** Never logs the token — pass only this header object to fetch, nowhere else. */
  private authHeaders(): Record<string, string> {
    return { "X-Shopify-Access-Token": this.accessToken, "Content-Type": "application/json" };
  }

  private async requestWithRetry(url: string): Promise<Response> {
    let attempt = 0;
    for (;;) {
      const response = await fetch(url, { headers: this.authHeaders() });
      if (response.status !== 429) return response;
      attempt += 1;
      if (attempt >= MAX_RETRIES) {
        throw new ShopifyRequestError(`Shopify rate limit exceeded after ${MAX_RETRIES} retries`);
      }
      const retryAfterSeconds = Number(response.headers.get("retry-after") ?? "2");
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
    }
  }

  private static parseNextLink(linkHeader: string | null): string | null {
    if (!linkHeader) return null;
    const next = linkHeader.split(",").find((part) => part.includes('rel="next"'));
    if (!next) return null;
    const match = next.match(/<([^>]+)>/);
    return match ? match[1] : null;
  }

  async testConnection(): Promise<ShopifyShopInfo> {
    const response = await this.requestWithRetry(this.baseUrl("/shop.json"));
    if (!response.ok) {
      throw new ShopifyRequestError(`Shopify connection test failed: ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as { shop: { name: string; currency: string } };
    return { name: body.shop.name, currency: body.shop.currency };
  }

  /**
   * Fully paginates via the Link header (Shopify's cursor-based pagination
   * — page-number params don't work on this endpoint) rather than fetching
   * only the first page, since even a routine 5-minute poll window or the
   * initial backfill can exceed the 250-per-page limit.
   */
  async fetchOrdersUpdatedSince(updatedAtMinIso: string): Promise<ShopifyRawOrder[]> {
    const orders: ShopifyRawOrder[] = [];
    let url: string | null = this.baseUrl(
      `/orders.json?status=any&limit=${PAGE_LIMIT}&updated_at_min=${encodeURIComponent(updatedAtMinIso)}`,
    );

    while (url) {
      const response: Response = await this.requestWithRetry(url);
      if (!response.ok) {
        throw new ShopifyRequestError(`Shopify orders fetch failed: ${response.status} ${response.statusText}`);
      }
      const body = (await response.json()) as { orders: ShopifyRawOrder[] };
      orders.push(...body.orders);
      url = ShopifyClient.parseNextLink(response.headers.get("link"));
    }

    return orders;
  }
}
