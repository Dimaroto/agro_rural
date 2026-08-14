import { resolveAuthSecret } from "./auth-secret";

function resolveAppUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_ENV === "production") {
    return "https://agroruralzortea.com.br";
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const config = {
  defaultStoreSlug:
    process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG ??
    process.env.DEFAULT_STORE_SLUG ??
    "saboart",
  customerAuthProvider: process.env.CUSTOMER_AUTH_PROVIDER ?? "mock",
  paymentsEnabled:
    process.env.PAYMENTS_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true",
  mercadoPagoAccessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? "",
  mercadoPagoPublicKey:
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() ||
    process.env.MERCADOPAGO_PUBLIC_KEY?.trim() ||
    "",
  mercadoPagoWebhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
  appUrl: resolveAppUrl(),
  get authSecret() {
    return resolveAuthSecret();
  },
  pixOrderExpiryMinutes: envPositiveInt(
    process.env.PIX_ORDER_EXPIRY_MINUTES,
    30
  ),
  checkoutExpiryMinutes: envPositiveInt(
    process.env.CHECKOUT_EXPIRY_MINUTES ?? process.env.PIX_ORDER_EXPIRY_MINUTES,
    60
  ),
  /** Expiração de pedidos em dinheiro/WhatsApp (libera estoque reservado). */
  cashOrderExpiryMinutes: envPositiveInt(
    process.env.CASH_ORDER_EXPIRY_MINUTES ??
      process.env.CHECKOUT_EXPIRY_MINUTES ??
      process.env.PIX_ORDER_EXPIRY_MINUTES,
    60 * 24
  ),
  /** Validade do token de acompanhamento do pedido (dias). */
  orderAccessTokenDays: envPositiveInt(
    process.env.ORDER_ACCESS_TOKEN_DAYS,
    30
  ),
  cardPaymentsEnabled:
    (process.env.PAYMENTS_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true") &&
    process.env.NEXT_PUBLIC_CARD_PAYMENTS_ENABLED !== "false" &&
    (!!process.env.MERCADOPAGO_ACCESS_TOKEN ||
      process.env.NODE_ENV !== "production"),
};

function envPositiveInt(value: string | undefined, fallback: number) {
  if (value == null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
