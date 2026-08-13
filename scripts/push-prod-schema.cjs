/**
 * Aplica prisma db push usando env do shell ou vercel env run.
 * Não faz seed. Não imprime secrets.
 */
const { execSync } = require("child_process");

function isPostgresUrl(value) {
  return !!value && /^postgres(ql)?:\/\//.test(String(value).trim());
}

function isRedacted(value) {
  if (!value) return false;
  const v = String(value).trim();
  return v === "[SENSITIVE]" || v.includes("[SENSITIVE]");
}

function resolveDatabaseEnv() {
  const pooledKeys = [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
  ];
  const directKeys = [
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
    "POSTGRES_URL_NON_POOLING",
  ];

  let pooled = null;
  for (const key of pooledKeys) {
    const value = process.env[key]?.trim();
    if (isRedacted(value)) continue;
    if (isPostgresUrl(value)) {
      pooled = value;
      process.env.DATABASE_URL = value;
      break;
    }
  }

  let direct = null;
  for (const key of directKeys) {
    const value = process.env[key]?.trim();
    if (isRedacted(value)) continue;
    if (isPostgresUrl(value)) {
      direct = value;
      process.env.DATABASE_URL_UNPOOLED = value;
      break;
    }
  }

  if (!direct && pooled) {
    process.env.DATABASE_URL_UNPOOLED = pooled;
    direct = pooled;
  }

  const hadRedacted = [...pooledKeys, ...directKeys].some((key) =>
    isRedacted(process.env[key])
  );

  if (!pooled) {
    console.error("[erro] DATABASE_URL vazia ou inválida.");
    console.error("");
    if (hadRedacted) {
      console.error(
        "A Vercel marcou a URL como sensível — o CLI não repassa o valor real."
      );
    } else {
      console.error(
        "O `vercel env run` nem sempre injeta DATABASE_URL no Windows."
      );
    }
    console.error("");
    console.error("Defina as URLs do Neon na MESMA janela do PowerShell:");
    console.error("  Vercel → Project → Settings → Environment Variables");
    console.error("  (Reveal em DATABASE_URL e POSTGRES_URL_NON_POOLING ou DIRECT_URL)");
    console.error("");
    console.error("  $env:DATABASE_URL = 'postgresql://...-pooler.../catalogo?sslmode=require'");
    console.error(
      "  $env:DATABASE_URL_UNPOOLED = 'postgresql://...direct.../catalogo?sslmode=require'"
    );
    console.error("  npm.cmd run db:push:prod");
    console.error("");
    console.error(
      "(O .env local não sobrescreve variáveis que você definir no shell.)"
    );
    process.exit(1);
  }

  return { pooled, direct };
}

const { pooled } = resolveDatabaseEnv();

const host = (() => {
  try {
    return new URL(pooled.replace(/^prisma\+?/, "postgresql")).hostname;
  } catch {
    return "";
  }
})();

function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

if (isLocalHost(host) && process.env.ALLOW_LOCAL_DB_PUSH !== "1") {
  console.error(
    "[erro] DATABASE_URL aponta para banco LOCAL (" + host + "), não para o Neon."
  );
  console.error("");
  console.error(
    "Você rodou sem URLs de produção — o Prisma usou o .env local (Docker)."
  );
  console.error("Defina as URLs do Neon e use -Manual:");
  console.error("");
  console.error("  $env:DATABASE_URL = 'postgresql://...-pooler.../catalogo?sslmode=require'");
  console.error(
    "  $env:DATABASE_URL_UNPOOLED = 'postgresql://.../catalogo?sslmode=require'"
  );
  console.error(
    "  powershell -ExecutionPolicy Bypass -File .\\scripts\\push-prod-schema-win.ps1 -Manual"
  );
  process.exit(1);
}

const hostLabel = host || "(host ilegível)";

const prismaCmd =
  process.platform === "win32"
    ? "npx.cmd prisma db push --skip-generate"
    : "npx prisma db push --skip-generate";

console.log("[neon] prisma db push →", hostLabel);
execSync(prismaCmd, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
console.log("[ok] schema de produção sincronizado");
