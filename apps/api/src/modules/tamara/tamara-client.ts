// Thin wrapper around Tamara's Checkout API (native fetch, same choice
// already made for the Shopify and WhatsApp clients).

const BASE_URLS: Record<string, string> = {
  sandbox: "https://api-sandbox.tamara.co",
  production: "https://api.tamara.co",
};

export interface TamaraCheckoutItem {
  referenceId: string;
  type: string;
  name: string;
  sku: string;
  quantity: number;
  totalAmount: number;
}

export interface CreateInStoreSessionInput {
  orderReferenceId: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  email?: string;
  orderNumber?: string;
  storeCode?: string;
  items: TamaraCheckoutItem[];
}

export interface CreateInStoreSessionResult {
  checkoutId: string;
  orderId: string;
  checkoutDeeplink: string;
}

export class TamaraRequestError extends Error {}

interface TamaraErrorBody {
  message?: string;
  errors?: Array<{ error_code?: string }>;
}

export class TamaraClient {
  constructor(
    private readonly apiKey: string,
    private readonly environment: string,
  ) {}

  private baseUrl(): string {
    return BASE_URLS[this.environment] ?? BASE_URLS.sandbox;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as TamaraErrorBody;
      if (body.message) return body.message;
    } catch {
      // fall through to generic message
    }
    return `${response.status} ${response.statusText}`;
  }

  async createInStoreCheckoutSession(input: CreateInStoreSessionInput): Promise<CreateInStoreSessionResult> {
    const payload = {
      total_amount: { amount: input.amount, currency: input.currency },
      phone_number: input.phoneNumber,
      order_reference_id: input.orderReferenceId,
      order_number: input.orderNumber,
      email: input.email,
      additional_data: input.storeCode ? { store_code: input.storeCode } : undefined,
      items: input.items.map((item) => ({
        reference_id: item.referenceId,
        type: item.type,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        total_amount: { amount: item.totalAmount, currency: input.currency },
      })),
    };

    const response = await fetch(`${this.baseUrl()}/checkout/in-store-session`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new TamaraRequestError(`Tamara checkout session failed: ${await this.parseErrorMessage(response)}`);
    }
    const body = (await response.json()) as { checkout_id: string; order_id: string; checkout_deeplink: string };
    return { checkoutId: body.checkout_id, orderId: body.order_id, checkoutDeeplink: body.checkout_deeplink };
  }
}
