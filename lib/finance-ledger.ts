import {
  FinanceCategoryKind,
  LedgerEntryStatus,
  LedgerEntryType,
  Prisma,
  type FinancialLedgerEntry,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureFinanceLedgerSchema } from "@/lib/ensure-finance-schema";
import { PublicApiError } from "@/lib/public-api-error";

export type Tx = Prisma.TransactionClient;

let financeSchemaEnsurePromise: Promise<void> | null = null;

async function ensureFinanceSchemaOnce() {
  if (!financeSchemaEnsurePromise) {
    financeSchemaEnsurePromise = ensureFinanceLedgerSchema(prisma).catch(
      (err) => {
        financeSchemaEnsurePromise = null;
        throw err;
      }
    );
  }
  await financeSchemaEnsurePromise;
}

/** Meio-dia UTC do dia YYYY-MM-DD (evita shift de fuso no filtro). */
export function dayNoonUtc(isoDay: string): Date {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function formatDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIsoDay(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function ensureDefaultFinanceCategories(
  storeId: string,
  tx: Tx = prisma
) {
  const defaults: {
    name: string;
    slug: string;
    kind: FinanceCategoryKind;
    sortOrder: number;
  }[] = [
    { name: "Vendas", slug: "vendas", kind: "INCOME", sortOrder: 1 },
    { name: "Outras receitas", slug: "outras-receitas", kind: "INCOME", sortOrder: 2 },
    { name: "Compras / Fornecedores", slug: "compras", kind: "EXPENSE", sortOrder: 1 },
    {
      name: "Despesas operacionais",
      slug: "despesas-operacionais",
      kind: "EXPENSE",
      sortOrder: 2,
    },
    { name: "Boletos", slug: "boletos", kind: "EXPENSE", sortOrder: 3 },
  ];
  for (const cat of defaults) {
    await tx.financeCategory.upsert({
      where: { storeId_slug: { storeId, slug: cat.slug } },
      create: { storeId, ...cat },
      update: { name: cat.name, kind: cat.kind, sortOrder: cat.sortOrder },
    });
  }
}

export async function listDayLedger(storeId: string, day: string) {
  const start = dayNoonUtc(day);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const run = async () => {
    const entries = await prisma.financialLedgerEntry.findMany({
      where: {
        storeId,
        status: "CONFIRMED",
        entryDate: { gte: start, lt: end },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    const incomeCents = entries
      .filter((e) => e.type === "INCOME")
      .reduce((s, e) => s + e.amountCents, 0);
    const expenseCents = entries
      .filter((e) => e.type === "EXPENSE")
      .reduce((s, e) => s + e.amountCents, 0);
    const cashClose = await prisma.cashClose.findUnique({
      where: { storeId_date: { storeId, date: start } },
    });
    return {
      day,
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
      closed: !!cashClose,
      cashClose,
      entries,
    };
  };

  try {
    return await run();
  } catch (e) {
    if (!isMissingFinanceTable(e)) throw mapLedgerTableMissing(e);
    try {
      await ensureFinanceSchemaOnce();
      return await run();
    } catch (e2) {
      throw mapLedgerTableMissing(e2);
    }
  }
}

function isMissingFinanceTable(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code !== "P2021") return false;
  const table = String((e.meta as { table?: string } | undefined)?.table ?? "");
  return /financial_ledger|cash_close|finance_categor/i.test(table) || !table;
}

function mapLedgerTableMissing(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
    const meta = e.meta as { table?: string } | undefined;
    const table = meta?.table ?? "";
    if (/financial_ledger/i.test(table)) {
      throw new PublicApiError(
        "Tabela financial_ledger_entries ausente. Rode: npm run db:setup:prod"
      );
    }
    if (/cash_close/i.test(table)) {
      throw new PublicApiError(
        "Tabela cash_closes ausente. Rode: npm run db:setup:prod"
      );
    }
    if (/finance_categor/i.test(table)) {
      throw new PublicApiError(
        "Tabela finance_categories ausente. Rode: npm run db:setup:prod"
      );
    }
    throw new PublicApiError(
      `Tabela do banco ausente${table ? ` (${table})` : ""}. Atualize o schema (db:setup:prod).`
    );
  }
  throw e;
}

export async function listPendingLedger(storeId: string) {
  const run = async () => {
    const entries = await prisma.financialLedgerEntry.findMany({
      where: { storeId, status: "PENDING" },
      orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }],
    });
    return {
      payables: entries.filter((e) => e.type === "EXPENSE"),
      receivables: entries.filter((e) => e.type === "INCOME"),
    };
  };
  try {
    return await run();
  } catch (e) {
    if (!isMissingFinanceTable(e)) throw mapLedgerTableMissing(e);
    await ensureFinanceSchemaOnce();
    return await run();
  }
}

export async function createLedgerEntry(
  storeId: string,
  data: {
    type: LedgerEntryType;
    status?: LedgerEntryStatus;
    description: string;
    amountCents: number;
    entryDate?: string | null;
    categoryId?: string | null;
    categoryLabel?: string | null;
    paymentMethod?: string;
    customerId?: string | null;
    customerName?: string | null;
    supplierId?: string | null;
    supplierName?: string | null;
    orderId?: string | null;
    purchaseInvoiceId?: string | null;
    nfeKey?: string | null;
    installmentNo?: string | null;
    boletoCode?: string | null;
    notes?: string | null;
    dedupeKey?: string | null;
  },
  tx: Tx = prisma
) {
  if (data.amountCents <= 0) throw new PublicApiError("Valor deve ser positivo");
  const status = data.status ?? "CONFIRMED";
  const entryDate = data.entryDate ? dayNoonUtc(data.entryDate) : null;
  return tx.financialLedgerEntry.create({
    data: {
      storeId,
      type: data.type,
      status,
      description: data.description,
      amountCents: data.amountCents,
      entryDate,
      categoryId: data.categoryId ?? null,
      categoryLabel: data.categoryLabel ?? null,
      paymentMethod: data.paymentMethod ?? "outro",
      customerId: data.customerId ?? null,
      customerName: data.customerName ?? null,
      supplierId: data.supplierId ?? null,
      supplierName: data.supplierName ?? null,
      orderId: data.orderId ?? null,
      purchaseInvoiceId: data.purchaseInvoiceId ?? null,
      nfeKey: data.nfeKey ?? null,
      installmentNo: data.installmentNo ?? null,
      boletoCode: data.boletoCode ?? null,
      notes: data.notes ?? null,
      dedupeKey: data.dedupeKey ?? null,
      confirmedAt: status === "CONFIRMED" ? new Date() : null,
    },
  });
}

export async function confirmLedgerEntry(
  storeId: string,
  id: string,
  opts: { entryDate: string; amountCents?: number; paymentMethod?: string }
) {
  const existing = await prisma.financialLedgerEntry.findFirst({
    where: { id, storeId },
  });
  if (!existing) throw new PublicApiError("Lançamento não encontrado");
  if (existing.status === "CONFIRMED") throw new PublicApiError("Já confirmado");

  const day = dayNoonUtc(opts.entryDate);
  const closed = await prisma.cashClose.findUnique({
    where: { storeId_date: { storeId, date: day } },
  });
  if (closed) throw new PublicApiError("Caixa do dia está fechado");

  return prisma.financialLedgerEntry.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      entryDate: day,
      amountCents: opts.amountCents ?? existing.amountCents,
      paymentMethod: opts.paymentMethod ?? existing.paymentMethod,
      confirmedAt: new Date(),
    },
  });
}

export async function closeCashDay(
  storeId: string,
  day: string,
  userId?: string | null,
  notes?: string | null
) {
  const summary = await listDayLedger(storeId, day);
  if (summary.closed) throw new PublicApiError("Caixa já fechado");
  try {
    return await prisma.cashClose.create({
      data: {
        storeId,
        date: dayNoonUtc(day),
        incomeCents: summary.incomeCents,
        expenseCents: summary.expenseCents,
        balanceCents: summary.balanceCents,
        incomeCount: summary.entries.filter((e) => e.type === "INCOME").length,
        expenseCount: summary.entries.filter((e) => e.type === "EXPENSE").length,
        notes: notes ?? null,
        closedByUserId: userId ?? null,
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new PublicApiError("Caixa já fechado");
    }
    if (isMissingFinanceTable(e)) {
      try {
        await ensureFinanceSchemaOnce();
        return await prisma.cashClose.create({
          data: {
            storeId,
            date: dayNoonUtc(day),
            incomeCents: summary.incomeCents,
            expenseCents: summary.expenseCents,
            balanceCents: summary.balanceCents,
            incomeCount: summary.entries.filter((e) => e.type === "INCOME")
              .length,
            expenseCount: summary.entries.filter((e) => e.type === "EXPENSE")
              .length,
            notes: notes ?? null,
            closedByUserId: userId ?? null,
          },
        });
      } catch (e2) {
        throw mapLedgerTableMissing(e2);
      }
    }
    throw e;
  }
}

export async function reopenCashDay(storeId: string, day: string) {
  const date = dayNoonUtc(day);
  const existing = await prisma.cashClose.findUnique({
    where: { storeId_date: { storeId, date } },
  });
  if (!existing) throw new PublicApiError("Caixa não está fechado");
  await prisma.cashClose.delete({ where: { id: existing.id } });
  return { ok: true };
}

export async function assertCashOpen(storeId: string, day: string) {
  const closed = await prisma.cashClose.findUnique({
    where: { storeId_date: { storeId, date: dayNoonUtc(day) } },
  });
  if (closed) throw new PublicApiError("Caixa do dia está fechado");
}

export type LedgerDto = FinancialLedgerEntry;
