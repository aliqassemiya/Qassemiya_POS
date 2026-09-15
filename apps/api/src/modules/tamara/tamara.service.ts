import { BadGatewayException, BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { newId } from "../../common/utils/uuid";
import { decryptToken, encryptToken } from "../../common/crypto/token-cipher";
import { TamaraClient, TamaraRequestError } from "./tamara-client";
import type { CreateTamaraSessionDto, UpsertTamaraIntegrationDto } from "./tamara.dto";

const TOKEN_ENC_KEY_VAR = "TAMARA_TOKEN_ENC_KEY";
const CURRENCY = "SAR";

@Injectable()
export class TamaraService {
  private readonly logger = new Logger(TamaraService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getIntegrationStatus() {
    const integration = await this.prisma.tamaraIntegration.findFirst();
    if (!integration) return null;
    // Deliberately omit apiKeyCipher/Iv/Tag -- write-only from the API's perspective.
    return {
      id: integration.id,
      environment: integration.environment,
      isActive: integration.isActive,
      updatedAt: integration.updatedAt,
    };
  }

  async upsertIntegration(dto: UpsertTamaraIntegrationDto) {
    const existing = await this.prisma.tamaraIntegration.findFirst();

    if (!existing && !dto.apiKey) {
      throw new BadRequestException("API key is required to connect Tamara for the first time");
    }

    const apiKey =
      dto.apiKey ??
      decryptToken({ cipher: existing!.apiKeyCipher, iv: existing!.apiKeyIv, tag: existing!.apiKeyTag }, TOKEN_ENC_KEY_VAR);

    const encrypted = encryptToken(apiKey, TOKEN_ENC_KEY_VAR);
    const tokenFields = { apiKeyCipher: encrypted.cipher, apiKeyIv: encrypted.iv, apiKeyTag: encrypted.tag };

    if (existing) {
      await this.prisma.tamaraIntegration.update({
        where: { id: existing.id },
        data: { environment: dto.environment, isActive: dto.isActive ?? existing.isActive, ...tokenFields },
      });
    } else {
      await this.prisma.tamaraIntegration.create({
        data: { id: newId(), environment: dto.environment, isActive: dto.isActive ?? true, ...tokenFields },
      });
    }
    return this.getIntegrationStatus();
  }

  private async log(
    orderReferenceId: string,
    status: "CREATED" | "FAILED",
    fields: { checkoutId?: string; tamaraOrderId?: string; checkoutDeeplink?: string; errorMessage?: string } = {},
  ) {
    try {
      await this.prisma.tamaraCheckoutLog.create({
        data: { id: newId(), orderReferenceId, status, ...fields },
      });
    } catch (err) {
      this.logger.error(`Failed to write Tamara checkout log for order ${orderReferenceId}: ${err}`);
    }
  }

  /**
   * Called live, synchronously, from the POS at the moment a cashier selects
   * Tamara -- this is what triggers Tamara's own SMS to the customer, so
   * unlike everything else in the offline-first POS flow, it cannot be
   * queued for later. Throws on failure (unlike WhatsApp's send, there is no
   * safe way to silently continue -- the cashier needs to know immediately
   * so they can pick a different payment method).
   */
  async createInStoreSession(dto: CreateTamaraSessionDto) {
    const integration = await this.prisma.tamaraIntegration.findFirst();
    if (!integration || !integration.isActive) {
      throw new BadRequestException("Tamara is not configured or is inactive");
    }

    const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId }, select: { code: true } });

    const apiKey = decryptToken(
      { cipher: integration.apiKeyCipher, iv: integration.apiKeyIv, tag: integration.apiKeyTag },
      TOKEN_ENC_KEY_VAR,
    );
    const client = new TamaraClient(apiKey, integration.environment);

    try {
      const result = await client.createInStoreCheckoutSession({
        orderReferenceId: dto.orderReferenceId,
        amount: dto.amount,
        currency: CURRENCY,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        orderNumber: dto.orderNumber,
        storeCode: branch?.code,
        items: dto.items,
      });
      await this.log(dto.orderReferenceId, "CREATED", {
        checkoutId: result.checkoutId,
        tamaraOrderId: result.orderId,
        checkoutDeeplink: result.checkoutDeeplink,
      });
      return result;
    } catch (err) {
      const errorMessage = err instanceof TamaraRequestError ? err.message : err instanceof Error ? err.message : String(err);
      await this.log(dto.orderReferenceId, "FAILED", { errorMessage });
      // Re-thrown as a proper HttpException (not a bare Error) so Nest's
      // default filter doesn't swallow the real reason into a generic 500 --
      // the cashier needs to see why Tamara rejected the sale.
      throw new BadGatewayException(errorMessage);
    }
  }
}
