/**
 * Backfill de códigos sequenciais nos produtos.
 * Uso: npx tsx scripts/backfill-product-codes.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.store.findMany({ select: { id: true, name: true } });

  for (const store of stores) {
    const products = await prisma.product.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, code: true },
    });

    let next = 1;
    const used = new Set(
      products.filter((p) => p.code != null && p.code > 0).map((p) => p.code as number)
    );

    await prisma.$transaction(async (tx) => {
      for (const product of products) {
        if (product.code != null && product.code > 0) {
          next = Math.max(next, product.code + 1);
          continue;
        }
        while (used.has(next)) next += 1;
        await tx.product.update({
          where: { id: product.id },
          data: { code: next },
        });
        used.add(next);
        next += 1;
      }

      await tx.store.update({
        where: { id: store.id },
        data: { nextProductCode: next },
      });
    });

    console.log(`[${store.name}] nextProductCode=${next}, produtos=${products.length}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
