/** IP do cliente atrás de proxy (Vercel, nginx, etc.). */
export function getClientIpFromHeaders(
  forwardedFor: string | null,
  realIp: string | null
): string {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return realIp?.trim() || "unknown";
}

export function getClientIpFromRequest(req: Request): string {
  return getClientIpFromHeaders(
    req.headers.get("x-forwarded-for"),
    req.headers.get("x-real-ip")
  );
}
