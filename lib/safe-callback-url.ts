/**
 * Aceita apenas caminhos relativos internos (anti open-redirect).
 * Ex.: /meus-pedidos, /conta/login — rejeita //evil.com e https://...
 */
export function safeStoreCallbackUrl(
  raw: string | null | undefined,
  fallback = "/"
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || trimmed.includes("@")) return fallback;
  try {
    const url = new URL(trimmed, "https://example.invalid");
    if (url.origin !== "https://example.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

/** Aceita apenas http(s) para links públicos (Maps, imagens externas). */
export function safeHttpUrl(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}
