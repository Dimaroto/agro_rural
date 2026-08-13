/** Variáveis públicas (NEXT_PUBLIC_*) para uso no cliente. */
import { safeHttpUrl } from "./safe-callback-url";

export const publicConfig = {
  pickupAddress:
    process.env.NEXT_PUBLIC_STORE_PICKUP_ADDRESS?.trim() ||
    "Rua Luiz Pedron, 357, Bairro Andorinhas, Zortéa - SC",
  pickupMapsLink: safeHttpUrl(
    process.env.NEXT_PUBLIC_STORE_PICKUP_MAPS_URL
  ),
  pixKey: process.env.NEXT_PUBLIC_PIX_KEY?.trim() || "",
  storeName:
    process.env.NEXT_PUBLIC_STORE_NAME?.trim() || "SaboArt da Dag",
  paymentsEnabled: process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true",
  /** Cartão online: explícito ou herdado de pagamentos habilitados. */
  cardPaymentsEnabled:
    process.env.NEXT_PUBLIC_CARD_PAYMENTS_ENABLED === "true" ||
    (process.env.NEXT_PUBLIC_CARD_PAYMENTS_ENABLED !== "false" &&
      process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true"),
  /** Public Key do Mercado Pago (Brick de cartão no carrinho). */
  mercadoPagoPublicKey:
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "",
};
