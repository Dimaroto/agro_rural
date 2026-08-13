import { config } from "@/lib/config";

const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

let cachedHmacKey: CryptoKey | null = null;
let cachedHmacSecret: string | null = null;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = config.authSecret;
  if (cachedHmacKey && cachedHmacSecret === secret) {
    return cachedHmacKey;
  }

  cachedHmacSecret = secret;
  cachedHmacKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return cachedHmacKey;
}

async function signPayload(payload: string): Promise<string> {
  const key = await getHmacKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`customer-session:${payload}`)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

/** Emite cookie de sessão assinado (customerId + expiração). */
export async function createCustomerSessionToken(
  customerId: string,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = `${customerId}.${exp}`;
  return `${payload}.${await signPayload(payload)}`;
}

/** Valida assinatura e expiração; retorna customerId ou null. */
export async function parseCustomerSessionToken(
  token: string | null | undefined
): Promise<string | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [customerId, expStr, sig] = parts;
  if (!customerId || !expStr || !sig) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const payload = `${customerId}.${expStr}`;
  const expected = await signPayload(payload);
  if (!timingSafeEqualStrings(expected, sig)) return null;

  return customerId;
}

export async function isValidCustomerSessionCookie(
  value: string | null | undefined
): Promise<boolean> {
  return (await parseCustomerSessionToken(value)) !== null;
}
