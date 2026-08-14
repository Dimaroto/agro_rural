/**
 * Normaliza variáveis do Neon / Vercel Marketplace para o Prisma.
 * DATABASE_URL = pooled (pgbouncer)
 * DATABASE_URL_UNPOOLED = conexão direta (migrate / db push)
 */

function isPostgresUrl(value: string | undefined): value is string {
  return !!value && /^postgres(ql)?:\/\//.test(value.trim());
}

function isRedacted(value: string | undefined) {
  if (!value) return false;
  const v = value.trim();
  return v === "[SENSITIVE]" || v.includes("[SENSITIVE]");
}

function firstPostgres(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (isRedacted(value)) continue;
    if (isPostgresUrl(value)) return value;
  }
  return null;
}

function withQuery(rawUrl: string, extra: Record<string, string>) {
  try {
    const normalized = rawUrl.replace(/^prisma\+?/, "postgresql");
    const u = new URL(normalized);
    for (const [key, val] of Object.entries(extra)) {
      if (!u.searchParams.has(key)) u.searchParams.set(key, val);
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function isPoolerHost(rawUrl: string) {
  try {
    return new URL(rawUrl.replace(/^prisma\+?/, "postgresql")).hostname.includes(
      "-pooler"
    );
  } catch {
    return false;
  }
}

export function applyNeonEnv() {
  const pooled = firstPostgres([
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "DATABASE_URL_POOLED",
  ]);
  const direct = firstPostgres([
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
    "POSTGRES_URL_NON_POOLING",
    "DATABASE_URL_UNPOOLED_DIRECT",
  ]);

  if (pooled) {
    const extras: Record<string, string> = { sslmode: "require" };
    if (isPoolerHost(pooled)) {
      extras.pgbouncer = "true";
      extras.connect_timeout = "15";
    }
    process.env.DATABASE_URL = withQuery(pooled, extras);
  }

  const unpooled = direct || pooled;
  if (unpooled) {
    process.env.DATABASE_URL_UNPOOLED = withQuery(unpooled, {
      sslmode: "require",
    });
  }

  if (!process.env.DIRECT_URL?.trim() && process.env.DATABASE_URL_UNPOOLED) {
    process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED;
  }

  return {
    pooled: process.env.DATABASE_URL || null,
    direct: process.env.DATABASE_URL_UNPOOLED || null,
  };
}
