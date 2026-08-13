import { handleMercadoPagoWebhook } from "@/lib/payments/webhook-handler";

/**
 * Webhook unificado do Mercado Pago (PIX + Checkout Pro / cartão).
 *
 * Configure em: Suas integrações → Webhooks → URL de notificação
 *   https://seu-dominio/api/webhooks/mercadopago
 *
 * Eventos: Payments (payment)
 * Segredo: MERCADOPAGO_WEBHOOK_SECRET (x-signature)
 */
export async function POST(req: Request) {
  return handleMercadoPagoWebhook(req);
}

/** IPN legado (notification_url) às vezes usa GET com ?topic=payment&id=... */
export async function GET(req: Request) {
  return handleMercadoPagoWebhook(req);
}
