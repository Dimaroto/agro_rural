import { createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";
import { orderAccessToken } from "../order-access";
import {
  assertMercadoPagoMinAmount,
  toMercadoPagoAmount,
} from "./mp-amount";
import type {
  CardCheckoutResult,
  CardTokenPaymentInput,
  CardTokenPaymentResult,
  PaymentProvider,
  PixChargeResult,
} from "./types";

const MP_API = "https://api.mercadopago.com";

/** E-mail aceito pelo MP quando o cliente não informou um. `.local` é rejeitado. */
const FALLBACK_PAYER_EMAIL = "cliente@saboartdadag.com.br";

function resolvePayerEmail(email?: string): string {
  const trimmed = email?.trim() ?? "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return trimmed;
  }
  return FALLBACK_PAYER_EMAIL;
}

type MpPaymentResponse = {
  id: number;
  status?: string;
  external_reference?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
  date_of_expiration?: string;
};

type MpPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  message?: string;
  error?: string;
};

export class MercadoPagoProvider implements PaymentProvider {
  private token: string;

  constructor(token = config.mercadoPagoAccessToken) {
    this.token = token;
  }

  private authHeaders(idempotencyKey?: string) {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
    };
  }

  private ensureToken() {
    if (!this.token) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
    }
  }

  async createPixCharge(params: {
    orderId: string;
    amountCents: number;
    description: string;
    payerEmail?: string;
  }): Promise<PixChargeResult> {
    this.ensureToken();

    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + config.pixOrderExpiryMinutes
    );

    assertMercadoPagoMinAmount(params.amountCents);

    const response = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: this.authHeaders(params.orderId),
      body: JSON.stringify({
        transaction_amount: toMercadoPagoAmount(params.amountCents),
        description: params.description,
        payment_method_id: "pix",
        payer: {
          email: resolvePayerEmail(params.payerEmail),
        },
        external_reference: params.orderId,
        date_of_expiration: expiresAt.toISOString(),
        notification_url: `${config.appUrl}/api/webhooks/mercadopago`,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Mercado Pago: ${err}`);
    }

    const data = (await response.json()) as MpPaymentResponse;
    const txData = data.point_of_interaction?.transaction_data;

    return {
      externalId: String(data.id),
      pixCopyPaste: txData?.qr_code ?? "",
      pixQrCode: txData?.qr_code_base64,
      expiresAt: data.date_of_expiration
        ? new Date(data.date_of_expiration)
        : expiresAt,
    };
  }

  async createCardTokenPayment(params: {
    orderId: string;
    amountCents: number;
    description: string;
    card: CardTokenPaymentInput;
  }): Promise<CardTokenPaymentResult> {
    this.ensureToken();

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.checkoutExpiryMinutes);

    assertMercadoPagoMinAmount(params.amountCents);

    const payer: Record<string, unknown> = {
      email: resolvePayerEmail(params.card.payerEmail),
    };
    if (params.card.identificationType && params.card.identificationNumber) {
      payer.identification = {
        type: params.card.identificationType,
        number: params.card.identificationNumber,
      };
    }

    const response = await fetch(`${MP_API}/v1/payments`, {
      method: "POST",
      headers: this.authHeaders(`${params.orderId}-card`),
      body: JSON.stringify({
        transaction_amount: toMercadoPagoAmount(params.amountCents),
        token: params.card.token,
        description: params.description,
        installments: params.card.installments,
        payment_method_id: params.card.paymentMethodId,
        issuer_id: params.card.issuerId ? Number(params.card.issuerId) : undefined,
        payer,
        external_reference: params.orderId,
        notification_url: `${config.appUrl}/api/webhooks/mercadopago`,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as MpPaymentResponse & {
      message?: string;
      status_detail?: string;
      cause?: Array<{ description?: string; code?: string }>;
    };
    if (!response.ok) {
      const cause = data.cause?.map((c) => c.description).filter(Boolean).join("; ");
      throw new Error(
        cause ||
          data.message ||
          data.status_detail ||
          "Erro ao cobrar o cartão no Mercado Pago"
      );
    }

    return {
      externalId: String(data.id),
      status: data.status ?? "pending",
      statusDetail: data.status_detail,
      expiresAt,
    };
  }

  async createCardCheckout(params: {
    orderId: string;
    amountCents: number;
    items: { name: string; quantity: number; unitPriceCents: number }[];
    customerName?: string;
    customerPhone?: string;
    payerEmail?: string;
  }): Promise<CardCheckoutResult> {
    this.ensureToken();
    assertMercadoPagoMinAmount(params.amountCents);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + config.checkoutExpiryMinutes);
    const expiresFrom = new Date();

    const body: Record<string, unknown> = {
      items: params.items.map((item, index) => ({
        id: String(index + 1),
        title: item.name.slice(0, 256),
        quantity: item.quantity,
        unit_price: Number((item.unitPriceCents / 100).toFixed(2)),
        currency_id: "BRL",
      })),
      external_reference: params.orderId,
      notification_url: `${config.appUrl}/api/webhooks/mercadopago`,
      back_urls: (() => {
        const token = encodeURIComponent(orderAccessToken(params.orderId));
        const base = `${config.appUrl}/pedido/${params.orderId}`;
        return {
          success: `${base}?status=success&token=${token}`,
          failure: `${base}?status=canceled&token=${token}`,
          pending: `${base}?status=success&token=${token}`,
        };
      })(),
      auto_return: "approved",
      expires: true,
      expiration_date_from: expiresFrom.toISOString(),
      expiration_date_to: expiresAt.toISOString(),
      // Checkout Pro só com cartão — PIX tem fluxo próprio com QR
      payment_methods: {
        excluded_payment_types: [
          { id: "ticket" },
          { id: "bank_transfer" },
        ],
      },
      statement_descriptor: "SaboArt",
    };

    if (params.customerName || params.payerEmail || params.customerPhone) {
      const phone = params.customerPhone?.replace(/\D/g, "") ?? "";
      body.payer = {
        name: params.customerName?.trim() || undefined,
        email: resolvePayerEmail(params.payerEmail),
        ...(phone
          ? {
              phone: {
                area_code: phone.slice(0, 2) || undefined,
                number: phone.slice(2) || phone,
              },
            }
          : {}),
      };
    }

    const response = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: this.authHeaders(params.orderId),
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as MpPreferenceResponse;
    if (!response.ok) {
      throw new Error(
        `Mercado Pago: ${data.message ?? data.error ?? "erro ao criar checkout"}`
      );
    }

    const isTestToken = this.token.startsWith("TEST-");
    const checkoutUrl = isTestToken
      ? data.sandbox_init_point ?? data.init_point
      : data.init_point ?? data.sandbox_init_point;

    if (!data.id || !checkoutUrl) {
      throw new Error("Resposta inválida do Mercado Pago ao criar checkout");
    }

    return {
      externalId: data.id,
      checkoutUrl,
      expiresAt,
    };
  }

  async getPayment(paymentId: string): Promise<MpPaymentResponse | null> {
    this.ensureToken();
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as MpPaymentResponse;
  }

  /** Busca pagamento aprovado pelo external_reference (= orderId), útil no Checkout Pro. */
  async findApprovedPaymentByOrderId(
    orderId: string
  ): Promise<MpPaymentResponse | null> {
    this.ensureToken();
    const params = new URLSearchParams({
      external_reference: orderId,
      status: "approved",
      sort: "date_created",
      criteria: "desc",
    });
    const res = await fetch(`${MP_API}/v1/payments/search?${params}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: MpPaymentResponse[] };
    return data.results?.[0] ?? null;
  }

  /**
   * Valida x-signature do webhook (HMAC-SHA256).
   * Manifesto: id:[data.id];request-id:[x-request-id];ts:[ts];
   * @see https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
   *
   * Em produção: exige MERCADOPAGO_WEBHOOK_SECRET e header x-signature.
   * Em desenvolvimento: sem segredo, aceita (consulta MP ainda valida o payment).
   */
  verifyWebhookSignature(
    headers: Headers,
    _body: string,
    dataIdFromQuery?: string | null
  ): boolean {
    const secret = config.mercadoPagoWebhookSecret;
    const isProd = process.env.NODE_ENV === "production";

    if (!secret) {
      return !isProd;
    }

    const xSignature = headers.get("x-signature");
    const xRequestId = headers.get("x-request-id") ?? "";
    // Em produção a assinatura é obrigatória; em dev, IPN legado sem header passa.
    if (!xSignature) {
      return !isProd;
    }

    const parts: Record<string, string> = {};
    for (const part of xSignature.split(",")) {
      const [key, ...rest] = part.split("=");
      if (key && rest.length) {
        parts[key.trim()] = rest.join("=").trim();
      }
    }

    const ts = parts.ts;
    const hash = parts.v1;
    if (!ts || !hash) return false;

    let dataId = (dataIdFromQuery ?? "").trim();
    if (dataId && /[A-Za-z]/.test(dataId)) {
      dataId = dataId.toLowerCase();
    }

    let manifest = "";
    if (dataId) manifest += `id:${dataId};`;
    if (xRequestId) manifest += `request-id:${xRequestId};`;
    manifest += `ts:${ts};`;

    const computed = createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

    try {
      const a = Buffer.from(computed, "utf8");
      const b = Buffer.from(hash, "utf8");
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseWebhookPaymentId(body: unknown, url?: URL): string | null {
    if (url) {
      const queryId =
        url.searchParams.get("data.id") ??
        (url.searchParams.get("topic") === "payment" ||
        url.searchParams.get("type") === "payment"
          ? url.searchParams.get("id")
          : null);
      if (queryId) return String(queryId);
    }

    const data = body as {
      type?: string;
      action?: string;
      data?: { id?: string | number };
      topic?: string;
      id?: string | number;
    };

    if (data?.type === "payment" && data.data?.id != null) {
      return String(data.data.id);
    }
    if (data?.topic === "payment" && data.id != null) {
      return String(data.id);
    }
    return null;
  }
}
