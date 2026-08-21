import type { PrismaClient } from "@prisma/client";

/**
 * Garante enums/tabelas do ledger financeiro (idempotente).
 * Usado quando o deploy Vercel não rodou db push no Neon atual.
 */
export async function ensureFinanceLedgerSchema(db: PrismaClient) {
  await db.$executeRawUnsafe(`
DO $$ BEGIN
  CREATE TYPE "FinanceCategoryKind" AS ENUM ('INCOME', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);
  await db.$executeRawUnsafe(`
DO $$ BEGIN
  CREATE TYPE "LedgerEntryType" AS ENUM ('INCOME', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);
  await db.$executeRawUnsafe(`
DO $$ BEGIN
  CREATE TYPE "LedgerEntryStatus" AS ENUM ('PENDING', 'CONFIRMED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`);

  await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "finance_categories" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "FinanceCategoryKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("id")
);
`);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "finance_categories_storeId_slug_key" ON "finance_categories"("storeId", "slug")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "finance_categories_storeId_kind_idx" ON "finance_categories"("storeId", "kind")`
  );

  await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "financial_ledger_entries" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'CONFIRMED',
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "entryDate" TIMESTAMP(3),
    "categoryId" TEXT,
    "categoryLabel" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'outro',
    "customerId" TEXT,
    "customerName" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "orderId" TEXT,
    "purchaseInvoiceId" TEXT,
    "nfeKey" TEXT,
    "installmentNo" TEXT,
    "boletoCode" TEXT,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_ledger_entries_pkey" PRIMARY KEY ("id")
);
`);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "financial_ledger_entries_storeId_dedupeKey_key" ON "financial_ledger_entries"("storeId", "dedupeKey")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "financial_ledger_entries_storeId_status_type_idx" ON "financial_ledger_entries"("storeId", "status", "type")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "financial_ledger_entries_storeId_entryDate_idx" ON "financial_ledger_entries"("storeId", "entryDate")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "financial_ledger_entries_storeId_nfeKey_idx" ON "financial_ledger_entries"("storeId", "nfeKey")`
  );

  await db.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS "cash_closes" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "incomeCents" INTEGER NOT NULL DEFAULT 0,
    "expenseCents" INTEGER NOT NULL DEFAULT 0,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "incomeCount" INTEGER NOT NULL DEFAULT 0,
    "expenseCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cash_closes_pkey" PRIMARY KEY ("id")
);
`);
  await db.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "cash_closes_storeId_date_key" ON "cash_closes"("storeId", "date")`
  );
  await db.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "cash_closes_storeId_idx" ON "cash_closes"("storeId")`
  );

  // FKs best-effort (podem falhar se a tabela pai não existir — ignoramos)
  const fks = [
    `ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    `ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "finance_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
    `ALTER TABLE "cash_closes" ADD CONSTRAINT "cash_closes_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  ];
  for (const sql of fks) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch {
      /* duplicate_object / missing parent — ok */
    }
  }
}
