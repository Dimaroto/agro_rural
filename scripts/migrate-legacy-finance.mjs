/**
 * Migra FinancialEntry / PayableAccount / pedidos a receber → FinancialLedgerEntry.
 * Idempotente via dedupeKey.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(path) {
  try {
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const i = trimmed.indexOf("=");
      if (i <= 0) continue;
      const key = trimmed.slice(0, i);
      let val = trimmed.slice(i + 1);
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv(resolve(process.cwd(), ".env.production.local"));
loadEnv(resolve(process.cwd(), ".env"));

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

function dayNoon(d) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)
  );
}

async function main() {
  const { ensureDefaultFinanceCategories } = await import(
    "../lib/finance-ledger.ts"
  ).catch(() => import("../lib/finance-ledger.js")).catch(async () => {
    // tsx resolves .ts
    return import("../lib/finance-ledger");
  });

  const stores = await prisma.store.findMany({ select: { id: true } });
  let entries = 0;
  let payables = 0;
  let orders = 0;

  for (const store of stores) {
    await ensureDefaultFinanceCategories(store.id);

    const fins = await prisma.financialEntry.findMany({
      where: { storeId: store.id },
      include: { category: true },
    });
    for (const e of fins) {
      const dedupeKey = `legacy_entry_${e.id}`;
      try {
        await prisma.financialLedgerEntry.create({
          data: {
            storeId: store.id,
            type: e.type === "INCOME" ? "INCOME" : "EXPENSE",
            status: "CONFIRMED",
            description: e.description,
            amountCents: e.amountCents,
            entryDate: dayNoon(e.entryDate),
            categoryLabel: e.category?.name ?? null,
            paymentMethod: "outro",
            orderId: e.orderId,
            dedupeKey,
            confirmedAt: e.createdAt,
          },
        });
        entries++;
      } catch {
        /* duplicate */
      }
    }

    const pays = await prisma.payableAccount.findMany({
      where: { storeId: store.id },
      include: { category: true },
    });
    for (const p of pays) {
      const dedupeKey = `legacy_payable_${p.id}`;
      try {
        await prisma.financialLedgerEntry.create({
          data: {
            storeId: store.id,
            type: "EXPENSE",
            status: p.status === "PAID" || p.paidAt ? "CONFIRMED" : "PENDING",
            description: p.title,
            amountCents: p.amountCents,
            entryDate: dayNoon(p.paidAt ?? p.dueDate),
            categoryLabel: p.category?.name ?? null,
            paymentMethod: "outro",
            notes: p.notes,
            dedupeKey,
            confirmedAt: p.paidAt,
          },
        });
        payables++;
      } catch {
        /* duplicate */
      }
    }

    // Raw: schema local pode ter colunas ainda não aplicadas no Neon.
    const receivableOrders = await prisma.$queryRaw`
      SELECT id, "orderNumber", status, "totalCents", "receivableDueAt",
             "customerId", "customerName", "updatedAt"
      FROM orders
      WHERE "storeId" = ${store.id}
        AND "receivableDueAt" IS NOT NULL
        AND status IN ('AWAITING_PAYMENT', 'PAID', 'DELIVERED')
    `;
    for (const o of receivableOrders) {
      if (!o.receivableDueAt) continue;
      const isPending = o.status === "AWAITING_PAYMENT";
      const dedupeKey = `order_${o.id}_receivable`;
      try {
        await prisma.financialLedgerEntry.create({
          data: {
            storeId: store.id,
            type: "INCOME",
            status: isPending ? "PENDING" : "CONFIRMED",
            description: `Pedido #${o.orderNumber ?? String(o.id).slice(0, 8)}`,
            amountCents: o.totalCents,
            entryDate: dayNoon(new Date(o.receivableDueAt)),
            categoryLabel: "Vendas",
            paymentMethod: "outro",
            customerId: o.customerId,
            customerName: o.customerName,
            orderId: o.id,
            dedupeKey,
            confirmedAt: isPending ? null : new Date(o.updatedAt),
          },
        });
        orders++;
      } catch {
        /* duplicate */
      }
    }
  }

  console.log(
    JSON.stringify({ ok: true, entries, payables, orders, stores: stores.length })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
