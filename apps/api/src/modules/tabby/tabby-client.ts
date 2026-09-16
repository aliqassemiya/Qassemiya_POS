// Thin wrapper around Tabby's Checkout API (native fetch, same choice made
// for the Shopify/WhatsApp/Tamara clients).
//
// Unlike Tamara's single-call flow, Tabby needs two calls: create the
// session, then a separate call to actually trigger the SMS to the
// customer -- the docs are explicit that send_hpp_link only works once the
// session comes back with status "created".

const BASE_URLS: Record<string, string> = {
  KSA: "https://api.tabby.sa",
  UAE: "https://api.tabby.ai",
};

export interface TabbyCheckoutItem {
  title: string;
  quantity: number;
  unitPrice: number;
  category?: string;
}

export interface CreateCheckoutSessionInput {
  orderReferenceId: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  lang: "ar" | "en";
  merchantCode: string;
  items: TabbyCheckoutItem[];
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  status: string;
  paymentId: string;
}

export class TabbyRequestError extends Error {}

interface TabbyErrorBody {
  error?: string;
  message?: string;
}

export class TabbyClient {
  constructor(
    private readonly secretKey: string,
    private readonly region: string,
  ) {}

  private baseUrl(): string {
    return BASE_URLS[this.region] ?? BASE_URLS.KSA;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.secretKey}`, "Content-Type": "application/json" };
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as TabbyErrorBody;
      if (body.message) return body.message;
      if (body.error) return body.error;
    } catch {
      // fall through to generic message
    }
    return `${response.status} ${response.statusText}`;
  }

  async createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
    const payload = {
      payment: {
        amount: input.amount.toFixed(2),
        currency: input.currency,
        buyer: { phone: input.phoneNumber },
        order: {
          reference_id: input.orderReferenceId,
          items: input.items.map((item) => ({
            title: item.title,
            quantity: item.quantity,
            unit_price: item.unitPrice.toFixed(2),
            category: item.category,
          })),
        },
      },
      lang: input.lang,
      merchant_code: input.merchantCode,
    };

    const response = await fetch(`${this.baseUrl()}/api/v2/checkout`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new TabbyRequestError(`Tabby checkout session failed: ${await this.parseErrorMessage(response)}`);
    }
    const body = (await response.json()) as { id: string; status: string; payment: { id: string } };
    if (body.status !== "created") {
      throw new TabbyRequestError(`Tabby checkout session was not approved (status: ${body.status})`);
    }
    return { sessionId: body.id, status: body.status, paymentId: body.payment.id };
  }

  /** Triggers Tabby to send the hosted-payment-page SMS link to the customer. */
  async sendHppLink(sessionId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl()}/api/v2/checkout/${sessionId}/send_hpp_link`, {
      method: "POST",
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      throw new TabbyRequestError(`Tabby SMS send failed: ${await this.parseErrorMessage(response)}`);
    }
  }
}
