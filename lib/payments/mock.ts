import { config } from "../config";
import { orderAccessToken } from "../order-access";
import type {
  CardCheckoutResult,
  CardTokenPaymentInput,
  CardTokenPaymentResult,
  PaymentProvider,
  PixChargeResult,
} from "./types";

/** Provedor mock para desenvolvimento sem token Mercado Pago */
export class MockPaymentProvider implements PaymentProvider {
  async createPixCharge(params: {
    orderId: string;
    amountCents: number;
  }): Promise<PixChargeResult> {
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + config.pixOrderExpiryMinutes
    );
    return {
      externalId: `mock-${params.orderId}`,
      pixCopyPaste: `00020126580014BR.GOV.BCB.PIX0136MOCK-${params.orderId}520400005303986540${(params.amountCents / 100).toFixed(2)}5802BR5925Catalogo Demo6009SAO PAULO62070503***6304ABCD`,
      expiresAt,
    };
  }

  async createCardCheckout(params: {
    orderId: string;
    amountCents: number;
    items: { name: string; quantity: number; unitPriceCents: number }[];
  }): Promise<CardCheckoutResult> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.checkoutExpiryMinutes);
    return {
      externalId: `mock-checkout-${params.orderId}`,
      checkoutUrl: `${config.appUrl}/pedido/${params.orderId}?token=${encodeURIComponent(orderAccessToken(params.orderId))}`,
      expiresAt,
    };
  }

  async createCardTokenPayment(params: {
    orderId: string;
    amountCents: number;
    description: string;
    card: CardTokenPaymentInput;
  }): Promise<CardTokenPaymentResult> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.checkoutExpiryMinutes);
    return {
      externalId: `mock-card-${params.orderId}-${params.card.token.slice(0, 8)}`,
      status: "pending",
      statusDetail: "pending_contingency",
      expiresAt,
    };
  }

  verifyWebhookSignature(): boolean {
    // Mock nunca confirma pagamentos via webhook em produção.
    return process.env.NODE_ENV !== "production";
  }

  parseWebhookPaymentId(body: unknown): string | null {
    const data = body as { mockPaymentId?: string };
    return data.mockPaymentId ?? null;
  }
}
