/** Headers de segurança HTTP (VULN-007). */
export function getSecurityHeaders(): { key: string; value: string }[] {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self' https://www.mercadopago.com.br https://www.mercadopago.com",
    "frame-ancestors 'none'",
    // Next.js + Tailwind + Mercado Pago Brick
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://sdk.mercadopago.com https://*.mercadopago.com",
    "style-src 'self' 'unsafe-inline' https://sdk.mercadopago.com",
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.mercadopago.com https://*.mercadolibre.com",
    "font-src 'self' data:",
    "connect-src 'self' https://api.mercadopago.com https://*.mercadopago.com https://*.mercadolibre.com",
    "frame-src 'self' https://*.mercadopago.com https://www.mercadopago.com https://www.mercadopago.com.br",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
  ].join("; ");

  const headers: { key: string; value: string }[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(self)",
    },
    { key: "Content-Security-Policy", value: csp },
  ];

  if (process.env.NODE_ENV === "production") {
    headers.unshift({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}
