/**
 * Atualiza o WhatsApp da loja padrão no banco.
 * Uso: node scripts/update-store-whatsapp.mjs [numero]
 */
import { existsSync } from "fs";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { PrismaClient } from "@prisma/client";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const prodEnv = path.join(root, ".env.production.local");

if (!process.env.DATABASE_URL?.trim() && existsSync(prodEnv)) {
  config({ path: prodEnv, override: true });
} else if (!process.env.DATABASE_URL?.trim()) {
  config({ path: path.join(root, ".env") });
}

const phone = (process.argv[2] ?? "554984376190").replace(/\D/g, "");
const slug =
  process.env.DEFAULT_STORE_SLUG?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG?.trim() ||
  "saboart";

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[erro] DATABASE_URL não definida.");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const store = await prisma.store.update({
    where: { slug },
    data: { whatsapp: phone },
    select: { name: true, slug: true, whatsapp: true },
  });
  console.log(`[ok] WhatsApp atualizado: ${store.name} (${store.slug}) → ${store.whatsapp}`);
} catch (err) {
  console.error("[erro]", err.message ?? err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
