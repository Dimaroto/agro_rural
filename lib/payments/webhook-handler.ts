import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { confirmOrderPayment } from "@/lib/orders";
import { getMercadoPagoProvider, getPaymentProvider } from "@/lib/payments";

/**
 * Handler do webhook Mercado Pago (PIX + Checkout Pro / cartão).
 *
 * URL canônica: POST /api/webhooks/mercadopago
 * Alias: POST /api/webhooks/pix
 *
 * Importante: o MP notifica várias vezes o mesmo payment (pending → approved).
 * Só marcamos o evento como processado após confirmar o pagamento aprovado.
 */
export async function handleMercadoPagoWebhook(req: Request) {
  const bodyText = await req.text();
  const url = new URL(req.url);
  const dataIdFromQuery = url.searchParams.get("data.id");
  const provider = getPaymentProvider();
  const isProd = process.env.NODE_ENV === "production";

  // Em produção, mock não deve processar webhooks (evita confirmação forjada).
  if (isProd && !process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "Webhook indisponível sem Mercado Pago configurado" },
      { status: 503 }
    );
  }

  if (!provider.verifyWebhookSignature(req.headers, bodyText, dataIdFromQuery)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let body: unknown = {};
  if (bodyText.trim()) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
  }

  const paymentId = provider.parseWebhookPaymentId(body, url);
  if (!paymentId) {
    return NextResponse.json({ received: true });
  }

  const providerName = process.env.MERCADOPAGO_ACCESS_TOKEN
    ? "mercadopago"
    : "mock";

  let orderId: string | undefined;
  let status: string | undefined;

  if (providerName === "mercadopago") {
    const mp = getMercadoPagoProvider();
    const payment = mp ? await mp.getPayment(paymentId) : null;
    if (!payment) {
      return NextResponse.json({ received: true, status: "not_found" });
    }
    status = payment.status;
    orderId = payment.external_reference || undefined;

    // Ainda pendente / em processamento — NÃO marcar como processado,
    // para a notificação de "approved" ser aceita depois.
    if (payment.status !== "approved") {
      return NextResponse.json({ received: true, status: payment.status });
    }
  }

  const eventId = `${providerName}-${paymentId}-approved`;

  try {
    await prisma.processedWebhookEvent.create({
      data: { provider: providerName, eventId },
    });
  } catch {
    // Já confirmamos este payment antes — idempotente
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await confirmOrderPayment(paymentId, providerName, { orderId });
  } catch (err) {
    // Libera o evento para retry do MP se a confirmação falhar
    await prisma.processedWebhookEvent
      .deleteMany({ where: { provider: providerName, eventId } })
      .catch(() => undefined);
    throw err;
  }

  return NextResponse.json({
    received: true,
    processed: true,
    status: status ?? "approved",
  });
}
