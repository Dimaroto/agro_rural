/**
 * Aplica schema e seed no banco de producao (Neon).
 * Uso: npm run db:setup:prod
 * Carrega .env.production.local (vercel env pull) se existir.
 */
import { execSync } from "child_process";
import { existsSync } from "fs";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const prodEnv = path.join(root, ".env.production.local");
if (!process.env.DATABASE_URL?.trim() && existsSync(prodEnv)) {
  config({ path: prodEnv, override: true });
} else if (!process.env.DATABASE_URL?.trim()) {
  config({ path: path.join(root, ".env") });
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[erro] Defina ${name} antes de rodar este script.`);
    process.exit(1);
  }
  return value;
}

requireEnv("DATABASE_URL");
if (!process.env.DATABASE_URL_UNPOOLED?.trim()) {
  process.env.DATABASE_URL_UNPOOLED =
    process.env.DIRECT_URL ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL;
}

console.log("[neon] Aplicando schema (prisma db push)...");
execSync("npx prisma db push", { cwd: root, stdio: "inherit", env: process.env });

console.log("[neon] Gerando imagens de produto e executando seed...");
execSync("npm run db:seed", { cwd: root, stdio: "inherit", env: process.env });

console.log("[neon] Banco pronto. Execute `npm run admin:update:prod` com ADMIN_PASSWORD para definir o admin.");
