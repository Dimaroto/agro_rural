/**
 * Aplica prisma db push usando env do shell ou vercel env run.
 * Não faz seed. Não imprime secrets.
 */
const { execSync } = require("child_process");
const { applyNeonEnv, isRedacted } = require("./neon-env.cjs");

function resolveDatabaseEnv() {
  const { pooled, direct } = applyNeonEnv();

  const hadRedacted = [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "DATABASE_URL_UNPOOLED",
    "DIRECT_URL",
    "POSTGRES_URL_NON_POOLING",
  ].some((key) => isRedacted(process.env[key]));

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
    console.error("  $env:DATABASE_URL = 'postgresql://...-pooler.../neondb?sslmode=require'");
    console.error(
      "  $env:DATABASE_URL_UNPOOLED = 'postgresql://...direct.../neondb?sslmode=require'"
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
