import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import { decryptToken, encryptToken } from "../../common/crypto/token-cipher";
import { normalizeSaudiPhone } from "../../common/utils/saudi-phone";
import { WhatsAppClient } from "./whatsapp-client";
import type {
  MessageLogListQueryDto,
  TestWhatsAppConnectionDto,
  UpsertWhatsAppIntegrationDto,
} from "./whatsapp.dto";

const DEFAULT_API_VERSION = "v21.0";
const TOKEN_ENC_KEY_VAR = "WHATSAPP_TOKEN_ENC_KEY";

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getIntegrationStatus() {
    const integration = await this.prisma.whatsAppIntegration.findFirst();
    if (!integration) return null;
    // Deliberately omit accessTokenCipher/Iv/Tag — write-only from the API's perspective.
    return {
      id: integration.id,
      phoneNumberId: integration.phoneNumberId,
      wabaId: integration.wabaId,
      apiVersion: integration.apiVersion,
      templateName: integration.templateName,
      templateLanguage: integration.templateLanguage,
      isActive: integration.isActive,
      updatedAt: integration.updatedAt,
    };
  }

  async testConnection(dto: TestWhatsAppConnectionDto) {
    const client = new WhatsAppClient(dto.phoneNumberId, dto.accessToken, DEFAULT_API_VERSION);
    return client.getPhoneNumberInfo();
  }

  async upsertIntegration(dto: UpsertWhatsAppIntegrationDto) {
    const existing = await this.prisma.whatsAppIntegration.findFirst();

    if (!existing && !dto.accessToken) {
      throw new BadRequestException("Access token is required to connect WhatsApp for the first time");
    }

    const accessToken =
      dto.accessToken ??
      decryptToken(
        { cipher: existing!.accessTokenCipher, iv: existing!.accessTokenIv, tag: existing!.accessTokenTag },
        TOKEN_ENC_KEY_VAR,
      );

    // Validate before persisting so a bad phone-number-id/token combo
    // surfaces immediately in the settings UI.
    await new WhatsAppClient(dto.phoneNumberId, accessToken, existing?.apiVersion ?? DEFAULT_API_VERSION).getPhoneNumberInfo();

    const encrypted = encryptToken(accessToken, TOKEN_ENC_KEY_VAR);
    const tokenFields = { accessTokenCipher: encrypted.cipher, accessTokenIv: encrypted.iv, accessTokenTag: encrypted.tag };

    if (existing) {
      await this.prisma.whatsAppIntegration.update({
        where: { id: existing.id },
        data: {
          phoneNumberId: dto.phoneNumberId,
          wabaId: dto.wabaId,
          templateName: dto.templateName,
          templateLanguage: dto.templateLanguage,
          isActive: dto.isActive ?? existing.isActive,
          ...tokenFields,
        },
      });
    } else {
      await this.prisma.whatsAppIntegration.create({
        data: {
          id: newId(),
          phoneNumberId: dto.phoneNumberId,
          wabaId: dto.wabaId,
          templateName: dto.templateName,
          templateLanguage: dto.templateLanguage,
          isActive: dto.isActive ?? true,
          ...tokenFields,
        },
      });
    }
    return this.getIntegrationStatus();
  }

  async getMessageLogs(query: MessageLogListQueryDto) {
    return this.prisma.whatsAppMessageLog.findMany({
      where: query.orderId ? { orderId: query.orderId } : undefined,
      orderBy: { createdAt: "desc" },
      take: query.orderId ? undefined : 50,
    });
  }

  async resend(orderId: string) {
    await this.sendInvoiceForOrder(orderId);
    return this.getMessageLogs({ orderId });
  }

  private async log(
    orderId: string,
    status: "SENT" | "SKIPPED" | "FAILED",
    fields: { customerPhone?: string | null; templateName?: string; whatsappMessageId?: string; errorMessage?: string } = {},
  ) {
    try {
      await this.prisma.whatsAppMessageLog.create({
        data: { id: newId(), orderId, status, ...fields },
      });
    } catch (err) {
      this.logger.error(`Failed to write WhatsApp message log for order ${orderId}: ${err}`);
    }
  }

  /**
   * Called fire-and-forget right after a sale commits. Never throws — every
   * path ends in a logged row instead, so a WhatsApp/network failure can
   * never fail the sale that triggered it or a POS sync bundle.
   */
  async sendInvoiceForOrder(orderId: string): Promise<void> {
    try {
      const integration = await this.prisma.whatsAppIntegration.findFirst();
      if (!integration || !integration.isActive) return; // not configured — expected, nothing to log

      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customer: { select: { phone: true } },
        },
      });
      if (!order) {
        await this.log(orderId, "FAILED", { errorMessage: "Order not found" });
        return;
      }

      if (!order.customer?.phone) {
        await this.log(orderId, "SKIPPED", { errorMessage: "No customer or customer has no phone number" });
        return;
      }

      const normalizedPhone = normalizeSaudiPhone(order.customer.phone);
      if (!normalizedPhone) {
        await this.log(orderId, "SKIPPED", {
          customerPhone: order.customer.phone,
          errorMessage: `Unrecognized phone number format: "${order.customer.phone}"`,
        });
        return;
      }

      const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
      const invoiceUrl = `${publicBaseUrl}/invoices/${order.id}`;

      const accessToken = decryptToken(
        { cipher: integration.accessTokenCipher, iv: integration.accessTokenIv, tag: integration.accessTokenTag },
        TOKEN_ENC_KEY_VAR,
      );
      const client = new WhatsAppClient(integration.phoneNumberId, accessToken, integration.apiVersion);

      // The approved receipt template ("order_confirm_whatsapp_temp_arabic")
      // has exactly one body variable: the invoice link.
      const whatsappMessageId = await client.sendTemplateMessage({
        to: normalizedPhone,
        templateName: integration.templateName,
        languageCode: integration.templateLanguage,
        bodyParams: [invoiceUrl],
      });

      await this.log(orderId, "SENT", { customerPhone: normalizedPhone, templateName: integration.templateName, whatsappMessageId });
    } catch (err) {
      await this.log(orderId, "FAILED", { errorMessage: err instanceof Error ? err.message : String(err) });
    }
  }
}
