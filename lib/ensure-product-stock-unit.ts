import { prisma } from "@/lib/db";

let ensurePromise: Promise<void> | null = null;

/** Garante enum StockUnit + coluna products.stockUnit (deploy pode chegar antes do db push). */
export function ensureProductStockUnitColumn() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "StockUnit" AS ENUM ('UN', 'KG');
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "products"
        ADD COLUMN IF NOT EXISTS "stockUnit" "StockUnit" NOT NULL DEFAULT 'UN';
      `);
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}
