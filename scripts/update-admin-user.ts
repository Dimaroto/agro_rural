import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ADMIN_LOGIN, normalizeAdminLogin } from "../lib/admin-login";
import { hashPassword } from "../lib/password-hash";

const useProductionEnv = process.argv.includes("--production");

function isPostgresUrl(value: string | undefined): value is string {
  return !!value && /^postgres(ql)?:\/\//.test(value.trim());
}

function isRedactedSecret(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  return v === "[SENSITIVE]" || v.includes("[SENSITIVE]");
}

/** Se já houver URL válida no shell, não sobrescrever com .env (ex.: placeholders da Vercel). */
const preloadedUrl = [
  process.env.DATABASE_URL,
  process.env.POSTGRES_PRISMA_URL,
  process.env.POSTGRES_URL,
  process.env.POSTGRES_URL_NON_POOLING,
].find(isPostgresUrl);

if (!preloadedUrl) {
  loadEnv({
    path: useProductionEnv ? ".env.production.local" : ".env",
    override: true,
  });
}

function resolvePostgresUrl(): string {
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "POSTGRES_URL_NON_POOLING",
  ]) {
    const value = process.env[key]?.trim();
    if (isRedactedSecret(value)) continue;
    if (isPostgresUrl(value)) {
      process.env.DATABASE_URL = value;
      return value;
    }
  }

  const hadRedacted = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ].some(isRedactedSecret);

  if (hadRedacted) {
    throw new Error(
      "DATABASE_URL veio como [SENSITIVE] (Vercel não baixa secrets sensíveis). " +
        "Copie o valor real em Vercel → Project → Settings → Environment Variables → DATABASE_URL (Reveal) " +
        "ou no painel Neon, e rode:\n" +
        "  $env:DATABASE_URL = 'postgresql://...'\n" +
        "  $env:ADMIN_PASSWORD = 'sua-senha'\n" +
        "  npm.cmd run admin:update:prod"
    );
  }

  throw new Error(
    "DATABASE_URL postgres não encontrada. Defina no shell ou use " +
      "`npx.cmd vercel env pull .env.production.local --environment=production` " +
      "(só funciona se a var não estiver marcada como Sensitive)."
  );
}

resolvePostgresUrl();

const prisma = new PrismaClient();

async function main() {
  const login = normalizeAdminLogin(
    process.env.ADMIN_LOGIN?.trim() || DEFAULT_ADMIN_LOGIN
  );
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("Defina ADMIN_PASSWORD no ambiente antes de executar.");
  }

  const store =
    (await prisma.store.findUnique({ where: { slug: "saboart" } })) ??
    (await prisma.store.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!store) {
    throw new Error("Nenhuma loja encontrada no banco.");
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.deleteMany({
    where: {
      storeId: store.id,
      NOT: { email: login },
    },
  });

  const user = await prisma.user.upsert({
    where: { email: login },
    update: {
      passwordHash,
      name: "Administrador",
      storeId: store.id,
    },
    create: {
      email: login,
      passwordHash,
      name: "Administrador",
      storeId: store.id,
    },
  });

  // Garante um único admin na loja (remove qualquer outro User).
  await prisma.user.deleteMany({
    where: {
      storeId: store.id,
      NOT: { id: user.id },
    },
  });

  console.log(`Admin atualizado: login=${user.email} store=${store.slug}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
