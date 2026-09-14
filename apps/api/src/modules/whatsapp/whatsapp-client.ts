// Thin wrapper around Meta's WhatsApp Cloud API (Graph API) using native
// fetch (Node 20+ has it built in — no new HTTP dependency, same choice
// already made for the Shopify client).

export interface WhatsAppPhoneNumberInfo {
  displayPhoneNumber: string;
  verifiedName: string;
}

export interface SendTemplateMessageInput {
  to: string; // plain-digit E.164 without "+", e.g. "966556889898"
  templateName: string;
  languageCode: string;
  bodyParams?: string[];
}

export class WhatsAppRequestError extends Error {}

interface MetaErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

export class WhatsAppClient {
  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
    private readonly apiVersion: string,
  ) {}

  private baseUrl(path: string): string {
    return `https://graph.facebook.com/${this.apiVersion}${path}`;
  }

  /** Never logs the token — pass only this header object to fetch, nowhere else. */
  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" };
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as MetaErrorBody;
      if (body.error?.message) return body.error.message;
    } catch {
      // fall through to generic message
    }
    return `${response.status} ${response.statusText}`;
  }

  async getPhoneNumberInfo(): Promise<WhatsAppPhoneNumberInfo> {
    const response = await fetch(this.baseUrl(`/${this.phoneNumberId}?fields=display_phone_number,verified_name`), {
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      throw new WhatsAppRequestError(`WhatsApp connection test failed: ${await this.parseErrorMessage(response)}`);
    }
    const body = (await response.json()) as { display_phone_number: string; verified_name: string };
    return { displayPhoneNumber: body.display_phone_number, verifiedName: body.verified_name };
  }

  /** Returns Meta's own message id (wamid...) for the sent message. */
  async sendTemplateMessage(input: SendTemplateMessageInput): Promise<string> {
    const payload = {
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        ...(input.bodyParams && input.bodyParams.length > 0
          ? { components: [{ type: "body", parameters: input.bodyParams.map((text) => ({ type: "text", text })) }] }
          : {}),
      },
    };

    const response = await fetch(this.baseUrl(`/${this.phoneNumberId}/messages`), {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new WhatsAppRequestError(`WhatsApp send failed: ${await this.parseErrorMessage(response)}`);
    }
    const body = (await response.json()) as { messages?: Array<{ id: string }> };
    const messageId = body.messages?.[0]?.id;
    if (!messageId) throw new WhatsAppRequestError("WhatsApp send succeeded but returned no message id");
    return messageId;
  }
}
