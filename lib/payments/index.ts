import { config } from "../config";
import { MercadoPagoProvider } from "./mercadopago";
import { MockPaymentProvider } from "./mock";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  if (config.mercadoPagoAccessToken) {
    return new MercadoPagoProvider();
  }
  return new MockPaymentProvider();
}

export function getMercadoPagoProvider(): MercadoPagoProvider | null {
  if (!config.mercadoPagoAccessToken) return null;
  return new MercadoPagoProvider();
}

export * from "./types";
