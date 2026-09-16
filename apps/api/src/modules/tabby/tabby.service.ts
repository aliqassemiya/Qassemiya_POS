import { BadGatewayException, BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import { decryptToken, encryptToken } from "../../common/crypto/token-cipher";
import { TabbyClient, TabbyRequestError } from "./tabby-client";
import type { CreateTabbySessionDto, UpsertTabbyIntegrationDto } from "./tabby.dto";

const TOKEN_ENC_KEY_VAR = "TABBY_TOKEN_ENC_KEY";
const CURRENCY = "SAR";

@Injectable()
export class TabbyService {
  private readonly logger = new Logger(TabbyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getIntegrationStatus() {
    const integration = await this.prisma.tabbyIntegration.findFirst();
    if (!integration) return null;
    // Deliberately omit secretKeyCipher/Iv/Tag -- write-only from the API's perspective.
    return {
      id: integration.id,
      merchantCode: integration.merchantCode,
      region: integration.region,
      isActive: integration.isActive,
      updatedAt: integration.updatedAt,
    };
  }

  async upsertIntegration(dto: UpsertTabbyIntegrationDto) {
    const existing = await this.prisma.tabbyIntegration.findFirst();

    if (!existing && !dto.secretKey) {
      throw new BadRequestException("Secret key is required to connect Tabby for the first time");
    }

    const secretKey =
      dto.secretKey ??
      decryptToken({ cipher: existing!.secretKeyCipher, iv: existing!.secretKeyIv, tag: existing!.secretKeyTag }, TOKEN_ENC_KEY_VAR);

    const encrypted = encryptToken(secretKey, TOKEN_ENC_KEY_VAR);
    const tokenFields = { secretKeyCipher: encrypted.cipher, secretKeyIv: encrypted.iv, secretKeyTag: encrypted.tag };

    if (existing) {
      await this.prisma.tabbyIntegration.update({
        where: { id: existing.id },
        data: { merchantCode: dto.merchantCode, region: dto.region, isActive: dto.isActive ?? existing.isActive, ...tokenFields },
      });
    } else {
      await this.prisma.tabbyIntegration.create({
        data: { id: newId(), merchantCode: dto.merchantCode, region: dto.region, isActive: dto.isActive ?? true, ...tokenFields },
      });
    }
    return this.getIntegrationStatus();
  }

  private async log(
    orderReferenceId: string,
    status: "CREATED" | "FAILED",
    fields: { sessionId?: string; paymentId?: string; errorMessage?: string } = {},
  ) {
    try {
      await this.prisma.tabbyCheckoutLog.create({
        data: { id: newId(), orderReferenceId, status, ...fields },
      });
    } catch (err) {
      this.logger.error(`Failed to write Tabby checkout log for order ${orderReferenceId}: ${err}`);
    }
  }

  /**
   * Called live, synchronously, from the POS at the moment a cashier selects
   * Tabby. Two calls to Tabby's API in sequence: create the session, then
   * trigger the SMS -- unlike Tamara, Tabby doesn't send it automatically on
   * session creation. Throws on failure, same reasoning as Tamara: the
   * cashier needs to know immediately so they can pick a different method.
   */
  async createInStoreSession(dto: CreateTabbySessionDto) {
    const integration = await this.prisma.tabbyIntegration.findFirst();
    if (!integration || !integration.isActive) {
      throw new BadRequestException("Tabby is not configured or is inactive");
    }

    const secretKey = decryptToken(
      { cipher: integration.secretKeyCipher, iv: integration.secretKeyIv, tag: integration.secretKeyTag },
      TOKEN_ENC_KEY_VAR,
    );
    const client = new TabbyClient(secretKey, integration.region);

    try {
      const session = await client.createCheckoutSession({
        orderReferenceId: dto.orderReferenceId,
        amount: dto.amount,
        currency: CURRENCY,
        phoneNumber: dto.phoneNumber,
        lang: dto.lang,
        merchantCode: integration.merchantCode,
        items: dto.items.map((item) => ({ title: item.title, quantity: item.quantity, unitPrice: item.unitPrice, category: item.category })),
      });
      await client.sendHppLink(session.sessionId);

      await this.log(dto.orderReferenceId, "CREATED", { sessionId: session.sessionId, paymentId: session.paymentId });
      return { sessionId: session.sessionId, paymentId: session.paymentId };
    } catch (err) {
      const errorMessage = err instanceof TabbyRequestError ? err.message : err instanceof Error ? err.message : String(err);
      await this.log(dto.orderReferenceId, "FAILED", { errorMessage });
      // Proper HttpException (not a bare Error) so Nest's default filter
      // doesn't swallow the real reason into a generic 500.
      throw new BadGatewayException(errorMessage);
    }
  }
}
