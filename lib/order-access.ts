import { createHmac, timingSafeEqual } from "crypto";
import { config } from "@/lib/config";

function signOrderView(orderId: string, exp: number): string {
  return createHmac("sha256", config.authSecret)
    .update(`order-view:${orderId}:${exp}`)
    .digest("base64url");
}

/** Token legado (sem expiração) — mantido só para links antigos. */
function signOrderViewLegacy(orderId: string): string {
  return createHmac("sha256", config.authSecret)
    .update(`order-view:${orderId}`)
    .digest("base64url");
}

function timingSafeEqualUtf8(a: string, b: string): boolean {
  try {
    const aa = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    return aa.length === bb.length && timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

/** Token opaco para o comprador acompanhar o pedido sem autenticação. */
export function orderAccessToken(orderId: string): string {
  const exp =
    Math.floor(Date.now() / 1000) + config.orderAccessTokenDays * 24 * 60 * 60;
  return `${exp}.${signOrderView(orderId, exp)}`;
}

export function verifyOrderAccessToken(
  orderId: string,
  token: string | null | undefined
): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length === 2) {
    const [expStr, sig] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
      return false;
    }
    return timingSafeEqualUtf8(signOrderView(orderId, exp), sig ?? "");
  }

  // Legado: HMAC sem expiração (links antigos).
  return timingSafeEqualUtf8(signOrderViewLegacy(orderId), token);
}

export function extractOrderAccessToken(req: Request): string | null {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("token")?.trim();
  if (fromQuery) return fromQuery;

  const header = req.headers.get("x-order-token")?.trim();
  return header || null;
}
