/** Constantes de cookie — sem dependências pesadas (safe para Edge middleware). */
export const CUSTOMER_SESSION_COOKIE = "customer_session";

/** Cookies de sessão do NextAuth v5 (JWT). */
export const AUTH_SESSION_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "__Host-authjs.session-token",
] as const;

export function hasAuthSessionCookie(
  cookies: { get: (name: string) => { value: string } | undefined }
): boolean {
  return AUTH_SESSION_COOKIE_NAMES.some((name) => Boolean(cookies.get(name)?.value));
}
