import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { buildPixPayload } from "@/lib/pix-emv";
import { publicConfig } from "@/lib/public-config";
import {
  enforceAuthRateLimit,
  PIX_QR_RATE_LIMIT,
  RateLimitError,
  rateLimitJsonResponse,
} from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  try {
    await enforceAuthRateLimit(
      "pix-qr",
      { ip: getClientIpFromRequest(req) },
      PIX_QR_RATE_LIMIT
    );
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitJsonResponse(e.retryAfterSeconds);
    }
    throw e;
  }

  const amountCents = Number(req.nextUrl.searchParams.get("amountCents"));
  // Sempre a chave da loja — ignora pixKey da query (anti-phishing).
  const pixKey = publicConfig.pixKey;

  if (!Number.isFinite(amountCents) || amountCents < 1 || amountCents > 10_000_000) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }

  if (!pixKey) {
    return NextResponse.json({ error: "Chave PIX não configurada." }, { status: 400 });
  }

  const payload = buildPixPayload({
    pixKey,
    amountCents,
    merchantName: publicConfig.storeName,
    merchantCity: "FLORIANOPOLIS",
  });

  const dataUrl = await QRCode.toDataURL(payload, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return NextResponse.json({ payload, dataUrl });
}
