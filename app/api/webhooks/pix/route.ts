import { handleMercadoPagoWebhook } from "@/lib/payments/webhook-handler";

/** Alias legado — preferir /api/webhooks/mercadopago */
export async function POST(req: Request) {
  return handleMercadoPagoWebhook(req);
}

export async function GET(req: Request) {
  return handleMercadoPagoWebhook(req);
}
