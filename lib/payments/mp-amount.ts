import { formatPrice } from "../format";

/** Valor mínimo aceito pelo Mercado Pago em cobranças online (cartão/PIX). */
export const MP_MIN_AMOUNT_CENTS = 50; // R$ 0,50

/** Converte centavos para o formato exigido pela API (máx. 2 casas decimais). */
export function toMercadoPagoAmount(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Valor da cobrança inválido.");
  }
  return Number((amountCents / 100).toFixed(2));
}

export function assertMercadoPagoMinAmount(amountCents: number): void {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("Valor da cobrança inválido.");
  }
  if (amountCents < MP_MIN_AMOUNT_CENTS) {
    throw new Error(
      `Valor mínimo para pagamento online é ${formatPrice(MP_MIN_AMOUNT_CENTS)}. Este pedido está em ${formatPrice(amountCents)}.`
    );
  }
}
