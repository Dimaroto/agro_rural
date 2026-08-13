/**
 * Prepara multi-categorias no banco ANTES do prisma db push.
 * - cria product_categories
 * - copia categoryId
 * - garante categoria lembrancinhas
 * - migra isPartyFavor=true para essa categoria
 *
 * Uso:
 *   DATABASE_URL=... node scripts/migrate-multi-categories.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS product_categories (
      "productId" TEXT NOT NULL,
      "categoryId" TEXT NOT NULL,
      CONSTRAINT product_categories_pkey PRIMARY KEY ("productId", "categoryId")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS product_categories_categoryId_idx
    ON product_categories ("categoryId");
  `);

  // FKs (ignora se já existirem)
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE product_categories
      ADD CONSTRAINT product_categories_productId_fkey
      FOREIGN KEY ("productId") REFERENCES products(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  } catch {
    /* already exists */
  }
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE product_categories
      ADD CONSTRAINT product_categories_categoryId_fkey
      FOREIGN KEY ("categoryId") REFERENCES categories(id)
      ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  } catch {
    /* already exists */
  }

  const stores = await prisma.$queryRawUnsafe(
    `SELECT id, slug FROM stores`
  );

  let linked = 0;
  let partyMigrated = 0;

  for (const store of stores) {
    let lembrancinhas = await prisma.$queryRawUnsafe(
      `SELECT id FROM categories WHERE "storeId" = $1 AND slug = 'lembrancinhas' LIMIT 1`,
      store.id
    );

    if (!lembrancinhas[0]) {
      const sortRows = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(MAX("sortOrder"), 0) + 1 AS next FROM categories WHERE "storeId" = $1`,
        store.id
      );
      const nextSort = Number(sortRows[0]?.next ?? 1);
      const created = await prisma.$queryRawUnsafe(
        `INSERT INTO categories (id, "storeId", name, slug, "sortOrder", active, "createdAt", "updatedAt")
         VALUES (md5(random()::text || clock_timestamp()::text), $1, 'Lembrancinhas', 'lembrancinhas', $2, true, NOW(), NOW())
         RETURNING id`,
        store.id,
        nextSort
      );
      lembrancinhas = created;
      console.log(`${store.slug}: criada categoria Lembrancinhas`);
    }

    const lembrancinhasId = lembrancinhas[0].id;

    const hasPartyFavor = await prisma.$queryRawUnsafe(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'isPartyFavor'
      LIMIT 1
    `);

    const products = hasPartyFavor.length
      ? await prisma.$queryRawUnsafe(
          `SELECT id, "categoryId", "isPartyFavor" FROM products WHERE "storeId" = $1`,
          store.id
        )
      : await prisma.$queryRawUnsafe(
          `SELECT id, "categoryId", false AS "isPartyFavor" FROM products WHERE "storeId" = $1`,
          store.id
        );

    for (const product of products) {
      const inserted = await prisma.$executeRawUnsafe(
        `INSERT INTO product_categories ("productId", "categoryId")
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        product.id,
        product.categoryId
      );
      if (inserted > 0) linked += 1;

      if (product.isPartyFavor) {
        const partyInsert = await prisma.$executeRawUnsafe(
          `INSERT INTO product_categories ("productId", "categoryId")
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          product.id,
          lembrancinhasId
        );
        if (partyInsert > 0) partyMigrated += 1;
      }
    }
  }

  console.log(
    `Concluído: ${linked} vínculos principais, ${partyMigrated} lembrancinhas migradas.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
