/**
 * Normaliza variáveis do Neon / Vercel Marketplace para o Prisma.
 * DATABASE_URL = pooled (pgbouncer)
 * DATABASE_URL_UNPOOLED = conexão direta (migrate / db push)
 */
function isPostgresUrl(value) {
  return !!value && /^postgres(ql)?:\/\//.test(String(value).trim());
}

function isRedacted(value) {
  if (!value) return false;
  const v = String(value).trim();
  return v === "[SENSITIVE]" || v.includes("[SENSITIVE]");
}

function firstPostgres(keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (isRedacted(value)) continue;
    if (isPostgresUrl(value)) return value;
  }
  return null;
}

function withQuery(rawUrl, extra) {
  try {
    const normalized = rawUrl.replace(/^prisma\+?/, "postgresql");
    const u = new URL(normalized);
    u.searchParams.delete("channel_binding");
    for (const [key, val] of Object.entries(extra)) {
      if (!u.searchParams.has(key)) u.searchParams.set(key, val);
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function isPoolerHost(rawUrl) {
  try {
    return new URL(rawUrl.replace(/^prisma\+?/, "postgresql")).hostname.includes(
      "-pooler"
    );
  } catch {
    return false;
  }
}

function applyNeonEnv() {
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
    const extras = { sslmode: "require" };
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

module.exports = { applyNeonEnv, isPostgresUrl, isRedacted };
