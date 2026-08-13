import { formatPrice } from "./format";
import {
  appendMapsLink,
  formatStructuredAddress,
  type StructuredAddress,
  validateStructuredAddress,
} from "./address";

export type FulfillmentType = "pickup" | "delivery";
export type PaymentMethod = "cash" | "pix" | "card";

export type CartCheckoutState = {
  fulfillmentType: FulfillmentType;
  deliveryAddress: StructuredAddress;
  paymentMethod: PaymentMethod;
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  card: "Cartão (crédito/débito online)",
};

export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  pickup: "Retirada no local",
  delivery: "Entrega",
};

export function validateCartCheckout(state: CartCheckoutState): string | null {
  if (state.fulfillmentType === "delivery") {
    const addressError = validateStructuredAddress(
      state.deliveryAddress,
      "endereço de entrega"
    );
    if (addressError) return addressError;
  }
  return null;
}

export function buildCartWhatsAppMessage({
  lines,
  subtotalCents,
  checkout,
  pickupAddress,
  pickupMapsLink = "",
  orderCode,
}: {
  lines: string[];
  subtotalCents: number;
  checkout: CartCheckoutState;
  pickupAddress: string;
  pickupMapsLink?: string;
  orderCode?: string;
}): string {
  const parts = [
    "Olá! Gostaria de pedir:",
    "",
    ...(orderCode ? [`*Pedido:* ${orderCode}`, ""] : []),
    ...lines,
    "",
    `*Total: ${formatPrice(subtotalCents)}*`,
    "",
    `*${FULFILLMENT_LABELS[checkout.fulfillmentType]}*`,
  ];

  if (checkout.fulfillmentType === "pickup") {
    parts.push(`*Endereço para retirada:* ${pickupAddress}`);
    appendMapsLink(parts, pickupMapsLink);
  } else {
    parts.push(
      `*Endereço de entrega:* ${formatStructuredAddress(checkout.deliveryAddress)}`
    );
    appendMapsLink(parts, checkout.deliveryAddress.mapsLink);
  }

  parts.push(`*Pagamento:* ${PAYMENT_METHOD_LABELS[checkout.paymentMethod]}`);

  return parts.join("\n");
}

/** Mensagem após pagamento online confirmado (webhook). */
export function buildPaidOrderWhatsAppMessage({
  orderCode,
  lines,
  totalCents,
  paymentMethod,
}: {
  /** Código sequencial exibido, ex.: PD0001 */
  orderCode: string;
  lines: string[];
  totalCents: number;
  paymentMethod: "pix" | "card";
}): string {
  return [
    "Olá! Meu pagamento foi confirmado e gostaria de combinar a entrega/retirada.",
    "",
    `*Pedido:* ${orderCode}`,
    "",
    ...lines,
    "",
    `*Total pago: ${formatPrice(totalCents)}*`,
    `*Pagamento:* ${PAYMENT_METHOD_LABELS[paymentMethod]} (online — confirmado)`,
  ].join("\n");
}

/** Abre o WhatsApp sem navegar a aba atual (melhor no mobile). */
export function openWhatsAppChat(phoneDigits: string, message: string) {
  const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
