export interface PixChargeResult {
  externalId: string;
  pixCopyPaste: string;
  pixQrCode?: string;
  expiresAt: Date;
}

export interface CardCheckoutResult {
  externalId: string;
  checkoutUrl: string;
  expiresAt: Date;
}

export interface CardTokenPaymentInput {
  token: string;
  paymentMethodId: string;
  installments: number;
  issuerId?: string;
  payerEmail?: string;
  identificationType?: string;
  identificationNumber?: string;
}

export interface CardTokenPaymentResult {
  externalId: string;
  status: string;
  statusDetail?: string;
  expiresAt: Date;
}

export type OnlinePaymentMethod = "pix" | "card";

export interface PaymentProvider {
  createPixCharge(params: {
    orderId: string;
    amountCents: number;
    description: string;
    payerEmail?: string;
  }): Promise<PixChargeResult>;

  createCardCheckout(params: {
    orderId: string;
    amountCents: number;
    items: { name: string; quantity: number; unitPriceCents: number }[];
    customerName?: string;
    customerPhone?: string;
    payerEmail?: string;
  }): Promise<CardCheckoutResult>;

  createCardTokenPayment?(params: {
    orderId: string;
    amountCents: number;
    description: string;
    card: CardTokenPaymentInput;
  }): Promise<CardTokenPaymentResult>;

  verifyWebhookSignature(
    headers: Headers,
    body: string,
    dataIdFromQuery?: string | null
  ): boolean;

  parseWebhookPaymentId(body: unknown, url?: URL): string | null;
}
