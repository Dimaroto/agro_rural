/**
 * Confere tabelas e dados mínimos no Neon (loja, categorias, admin).
 * DATABASE_URL e DATABASE_URL_UNPOOLED no shell, depois: npx tsx scripts/verify-prod-db.mjs
 */
import { createRequire } from "module";
import { PrismaClient } from "@prisma/client";

const { applyNeonEnv } = createRequire(import.meta.url)("./neon-env.cjs");
applyNeonEnv();

const prisma = new PrismaClient();

const REQUIRED_TABLES = [
  "stores",
  "users",
  "categories",
  "products",
  "product_categories",
  "product_measures",
  "product_customization_fields",
  "product_customization_field_options",
  "inventory_movements",
  "customers",
  "orders",
  "order_items",
  "payments",
  "processed_webhook_events",
  "expense_categories",
  "financial_entries",
  "payable_accounts",
  "subscriptions",
  "tax_records",
  "financial_settings",
  "auth_rate_limit_buckets",
  "admin_push_subscriptions",
];

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
  );
  const present = new Set(
    rows.map((r) => r.tablename)
  );
  const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
  if (missing.length) {
    console.error("[erro] Tabelas faltando:", missing.join(", "));
    process.exit(1);
  }
  console.log(
    "[ok] Todas as tabelas necessárias existem (" + REQUIRED_TABLES.length + ")"
  );

  const store = await prisma.store.findFirst({
    where: { slug: "saboart" },
  });
  if (!store) {
    console.error("[erro] Loja saboart não encontrada");
    process.exit(1);
  }

  await prisma.store.update({
    where: { id: store.id },
    data: { name: "Agrorural Agropecuária" },
  });

  const [users, categories, products, finance] = await Promise.all([
    prisma.user.count({ where: { storeId: store.id } }),
    prisma.category.count({ where: { storeId: store.id, active: true } }),
    prisma.product.count({ where: { storeId: store.id } }),
    prisma.financialSettings.count({ where: { storeId: store.id } }),
  ]);

  console.log("[ok] Loja: Agrorural Agropecuária / slug", store.slug);
  console.log("[ok] Admins:", users);
  console.log("[ok] Categorias:", categories);
  console.log("[ok] Produtos:", products);
  console.log("[ok] Config financeira:", finance);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
