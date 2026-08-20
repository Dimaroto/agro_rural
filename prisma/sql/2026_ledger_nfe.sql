-- Notas Fiscais + Financeiro (Bedendo port)
-- Novas tabelas apenas; não altera legado FinancialEntry/PayableAccount ainda.

CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT NOT NULL,
    "ie" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "cityCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_storeId_document_key" ON "suppliers"("storeId", "document");
CREATE INDEX IF NOT EXISTS "suppliers_storeId_idx" ON "suppliers"("storeId");

DO $$ BEGIN
  ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "purchase_invoices" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT,
    "accessKey" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "model" INTEGER NOT NULL DEFAULT 55,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "bcIcmsCents" INTEGER NOT NULL DEFAULT 0,
    "icmsCents" INTEGER NOT NULL DEFAULT 0,
    "pisCents" INTEGER NOT NULL DEFAULT 0,
    "cofinsCents" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" TEXT,
    "invoiceNumber" TEXT,
    "xmlContent" TEXT,
    "emitenteName" TEXT NOT NULL,
    "emitenteDoc" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_invoices_storeId_accessKey_key" ON "purchase_invoices"("storeId", "accessKey");
CREATE INDEX IF NOT EXISTS "purchase_invoices_storeId_importedAt_idx" ON "purchase_invoices"("storeId", "importedAt");
CREATE INDEX IF NOT EXISTS "purchase_invoices_supplierId_idx" ON "purchase_invoices"("supplierId");

DO $$ BEGIN
  ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "purchase_invoice_items" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "lineNumber" INTEGER NOT NULL DEFAULT 0,
    "supplierCode" TEXT,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "ncm" TEXT,
    "cfop" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "origin" TEXT DEFAULT '0',
    "csosn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "purchase_invoice_items_purchaseInvoiceId_idx" ON "purchase_invoice_items"("purchaseInvoiceId");
CREATE INDEX IF NOT EXISTS "purchase_invoice_items_productId_idx" ON "purchase_invoice_items"("productId");

DO $$ BEGIN
  ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_purchaseInvoiceId_fkey"
    FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FinanceCategoryKind" AS ENUM ('INCOME', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerEntryType" AS ENUM ('INCOME', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LedgerEntryStatus" AS ENUM ('PENDING', 'CONFIRMED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

CREATE UNIQUE INDEX IF NOT EXISTS "finance_categories_storeId_slug_key" ON "finance_categories"("storeId", "slug");
CREATE INDEX IF NOT EXISTS "finance_categories_storeId_kind_idx" ON "finance_categories"("storeId", "kind");

DO $$ BEGIN
  ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

CREATE UNIQUE INDEX IF NOT EXISTS "financial_ledger_entries_storeId_dedupeKey_key" ON "financial_ledger_entries"("storeId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "financial_ledger_entries_storeId_status_type_idx" ON "financial_ledger_entries"("storeId", "status", "type");
CREATE INDEX IF NOT EXISTS "financial_ledger_entries_storeId_entryDate_idx" ON "financial_ledger_entries"("storeId", "entryDate");
CREATE INDEX IF NOT EXISTS "financial_ledger_entries_storeId_nfeKey_idx" ON "financial_ledger_entries"("storeId", "nfeKey");

DO $$ BEGIN
  ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "finance_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "financial_ledger_entries" ADD CONSTRAINT "financial_ledger_entries_purchaseInvoiceId_fkey"
    FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

CREATE UNIQUE INDEX IF NOT EXISTS "cash_closes_storeId_date_key" ON "cash_closes"("storeId", "date");
CREATE INDEX IF NOT EXISTS "cash_closes_storeId_idx" ON "cash_closes"("storeId");

DO $$ BEGIN
  ALTER TABLE "cash_closes" ADD CONSTRAINT "cash_closes_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Adiciona NFE_PURCHASE ao enum MovementType se ainda não existir
DO $$ BEGIN
  ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'NFE_PURCHASE';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
