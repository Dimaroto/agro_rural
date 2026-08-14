import {
  FinancialEntryType,
  OrderStatus,
  PayableStatus,
  PaymentStatus,
} from "@prisma/client";
import { decryptCustomerPii } from "@/lib/customer-field-crypto";
import { prisma } from "@/lib/db";
import { ensureExpenseCategories, ensureFinancialSettings } from "@/lib/finance-defaults";
import { completedSaleStatuses } from "@/lib/order-status";

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

async function getOrderRevenueCents(
  storeId: string,
  from?: Date,
  to?: Date
): Promise<number> {
  const statuses = completedSaleStatuses();
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      status: { in: statuses },
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    select: { totalCents: true },
  });
  return orders.reduce((s, o) => s + o.totalCents, 0);
}

async function getManualEntrySum(
  storeId: string,
  type: FinancialEntryType,
  from?: Date,
  to?: Date
): Promise<number> {
  const entries = await prisma.financialEntry.findMany({
    where: {
      storeId,
      type,
      ...(from || to
        ? {
            entryDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    select: { amountCents: true },
  });
  return entries.reduce((s, e) => s + e.amountCents, 0);
}

async function getTotalExpensesCents(
  storeId: string,
  from?: Date,
  to?: Date
): Promise<number> {
  const [manual, paidPayables] = await Promise.all([
    getManualEntrySum(storeId, FinancialEntryType.EXPENSE, from, to),
    prisma.payableAccount.aggregate({
      where: {
        storeId,
        status: PayableStatus.PAID,
        ...(from || to
          ? {
              paidAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      _sum: { amountCents: true },
    }),
  ]);
  return manual + (paidPayables._sum.amountCents ?? 0);
}

async function getTotalIncomeCents(
  storeId: string,
  from?: Date,
  to?: Date
): Promise<number> {
  const [orders, manual] = await Promise.all([
    getOrderRevenueCents(storeId, from, to),
    getManualEntrySum(storeId, FinancialEntryType.INCOME, from, to),
  ]);
  return orders + manual;
}

export async function getFinancialSettings(storeId: string) {
  await ensureExpenseCategories(storeId);
  return ensureFinancialSettings(storeId);
}

export async function getExpenseCategories(storeId: string) {
  await ensureExpenseCategories(storeId);
  return prisma.expenseCategory.findMany({
    where: { storeId },
    orderBy: { sortOrder: "asc" },
  });
}

export type FinanceDashboard = {
  balanceCents: number;
  monthRevenueCents: number;
  monthExpensesCents: number;
  monthProfitCents: number;
  pendingReceivablesCents: number;
  pendingPayablesCents: number;
  overduePayablesCount: number;
  pendingPixCount: number;
  cashFlowMonths: { label: string; incomeCents: number; expenseCents: number }[];
  recentRevenues: { id: string; description: string; amountCents: number; date: Date; source: string }[];
  recentExpenses: { id: string; description: string; amountCents: number; date: Date; category?: string }[];
};

export async function getFinanceDashboard(storeId: string): Promise<FinanceDashboard> {
  const settings = await getFinancialSettings(storeId);
  const monthStart = startOfMonth();
  const monthEnd = endOfMonth();
  const now = new Date();

  const [
    totalIncome,
    totalExpenses,
    monthRevenueCents,
    monthExpensesCents,
    pendingOrders,
    pendingPayables,
    overduePayablesCount,
    pendingPixCount,
    recentIncomeEntries,
    recentExpenseEntries,
    paidOrders,
  ] = await Promise.all([
    getTotalIncomeCents(storeId),
    getTotalExpensesCents(storeId),
    getTotalIncomeCents(storeId, monthStart, monthEnd),
    getTotalExpensesCents(storeId, monthStart, monthEnd),
    prisma.order.findMany({
      where: { storeId, status: OrderStatus.AWAITING_PIX },
      select: { id: true, totalCents: true, createdAt: true, customerName: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.payableAccount.aggregate({
      where: { storeId, status: PayableStatus.PENDING },
      _sum: { amountCents: true },
    }),
    prisma.payableAccount.count({
      where: { storeId, status: PayableStatus.PENDING, dueDate: { lt: now } },
    }),
    prisma.order.count({ where: { storeId, status: OrderStatus.AWAITING_PIX } }),
    prisma.financialEntry.findMany({
      where: { storeId, type: FinancialEntryType.INCOME },
      orderBy: { entryDate: "desc" },
      take: 5,
    }),
    prisma.financialEntry.findMany({
      where: { storeId, type: FinancialEntryType.EXPENSE },
      include: { category: true },
      orderBy: { entryDate: "desc" },
      take: 5,
    }),
    prisma.order.findMany({
      where: { storeId, status: { in: completedSaleStatuses() } },
      select: { id: true, totalCents: true, createdAt: true, customerName: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const balanceCents =
    settings.openingBalanceCents + totalIncome - totalExpenses;

  const cashFlowMonths: FinanceDashboard["cashFlowMonths"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = startOfMonth(d);
    const to = endOfMonth(d);
    const key = monthKey(d);
    const [incomeCents, expenseCents] = await Promise.all([
      getTotalIncomeCents(storeId, from, to),
      getTotalExpensesCents(storeId, from, to),
    ]);
    cashFlowMonths.push({ label: monthLabel(key), incomeCents, expenseCents });
  }

  const recentRevenues = [
    ...paidOrders.map((o) => ({
      id: o.id,
      description: `Pedido ${o.customerName ?? o.id.slice(0, 8)}`,
      amountCents: o.totalCents,
      date: o.createdAt,
      source: "ORDER",
    })),
    ...recentIncomeEntries.map((e) => ({
      id: e.id,
      description: e.description,
      amountCents: e.amountCents,
      date: e.entryDate,
      source: e.source,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  const recentExpenses = recentExpenseEntries.map((e) => ({
    id: e.id,
    description: e.description,
    amountCents: e.amountCents,
    date: e.entryDate,
    category: e.category?.name,
  }));

  return {
    balanceCents,
    monthRevenueCents,
    monthExpensesCents,
    monthProfitCents: monthRevenueCents - monthExpensesCents,
    pendingReceivablesCents: pendingOrders.reduce((s, o) => s + o.totalCents, 0),
    pendingPayablesCents: pendingPayables._sum.amountCents ?? 0,
    overduePayablesCount,
    pendingPixCount,
    cashFlowMonths,
    recentRevenues,
    recentExpenses,
  };
}

export type RevenueRow = {
  id: string;
  description: string;
  amountCents: number;
  date: Date;
  source: string;
  orderId?: string | null;
};

export async function getRevenues(storeId: string): Promise<RevenueRow[]> {
  const [orders, entries] = await Promise.all([
    prisma.order.findMany({
      where: { storeId, status: { in: completedSaleStatuses() } },
      select: {
        id: true,
        totalCents: true,
        createdAt: true,
        customerName: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.financialEntry.findMany({
      where: { storeId, type: FinancialEntryType.INCOME },
      orderBy: { entryDate: "desc" },
    }),
  ]);

  return [
    ...orders.map((o) => ({
      id: o.id,
      description: `Venda — ${o.customerName ?? "Cliente"}`,
      amountCents: o.totalCents,
      date: o.createdAt,
      source: "ORDER",
      orderId: o.id,
    })),
    ...entries.map((e) => ({
      id: e.id,
      description: e.description,
      amountCents: e.amountCents,
      date: e.entryDate,
      source: e.source,
      orderId: e.orderId,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getExpenses(storeId: string) {
  await ensureExpenseCategories(storeId);
  const [entries, categories] = await Promise.all([
    prisma.financialEntry.findMany({
      where: { storeId, type: FinancialEntryType.EXPENSE },
      include: { category: true },
      orderBy: { entryDate: "desc" },
    }),
    prisma.expenseCategory.findMany({
      where: { storeId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const byCategory = categories.map((cat) => ({
    category: cat,
    totalCents: entries
      .filter((e) => e.categoryId === cat.id)
      .reduce((s, e) => s + e.amountCents, 0),
    entries: entries.filter((e) => e.categoryId === cat.id),
  }));

  const uncategorized = entries.filter((e) => !e.categoryId);

  return { entries, byCategory, uncategorized };
}

export type CashFlowMonth = {
  key: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  cumulativeCents: number;
};

export async function getCashFlow(storeId: string) {
  const settings = await getFinancialSettings(storeId);
  const now = new Date();
  const months: CashFlowMonth[] = [];
  let cumulative = settings.openingBalanceCents;

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = startOfMonth(d);
    const to = endOfMonth(d);
    const key = monthKey(d);
    const [incomeCents, expenseCents] = await Promise.all([
      getTotalIncomeCents(storeId, from, to),
      getTotalExpensesCents(storeId, from, to),
    ]);
    const balanceCents = incomeCents - expenseCents;
    cumulative += balanceCents;
    months.push({
      key,
      label: monthLabel(key),
      incomeCents,
      expenseCents,
      balanceCents,
      cumulativeCents: cumulative,
    });
  }

  const [pendingReceivables, pendingPayables] = await Promise.all([
    prisma.order.aggregate({
      where: { storeId, status: OrderStatus.AWAITING_PIX },
      _sum: { totalCents: true },
    }),
    prisma.payableAccount.aggregate({
      where: { storeId, status: PayableStatus.PENDING },
      _sum: { amountCents: true },
    }),
  ]);

  return {
    months,
    projectedBalanceCents:
      cumulative +
      (pendingReceivables._sum.totalCents ?? 0) -
      (pendingPayables._sum.amountCents ?? 0),
    pendingReceivablesCents: pendingReceivables._sum.totalCents ?? 0,
    pendingPayablesCents: pendingPayables._sum.amountCents ?? 0,
  };
}

export async function getReceivables(storeId: string) {
  return prisma.order.findMany({
    where: {
      storeId,
      OR: [
        { status: OrderStatus.AWAITING_PIX },
        { status: OrderStatus.AWAITING_PAYMENT },
      ],
    },
    include: { payment: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPayables(storeId: string) {
  const now = new Date();
  const payables = await prisma.payableAccount.findMany({
    where: { storeId },
    include: { category: true },
    orderBy: { dueDate: "asc" },
  });

  for (const p of payables) {
    if (p.status === PayableStatus.PENDING && p.dueDate < now) {
      await prisma.payableAccount.update({
        where: { id: p.id },
        data: { status: PayableStatus.OVERDUE },
      });
      p.status = PayableStatus.OVERDUE;
    }
  }

  return payables;
}

export async function getFinanceCustomers(storeId: string) {
  const customers = await prisma.customer.findMany({
    where: {
      OR: [{ storeId }, { orders: { some: { storeId } } }],
    },
    include: {
      orders: {
        where: { storeId },
        select: {
          id: true,
          totalCents: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { email: "asc" },
  });

  const saleStatuses = completedSaleStatuses();

  return customers
    .map((c) => {
      const storeOrders = c.orders;
      const paidOrders = storeOrders.filter((o) =>
        saleStatuses.includes(o.status)
      );
      const pendingOrders = storeOrders.filter(
        (o) =>
          o.status === OrderStatus.AWAITING_PIX ||
          o.status === OrderStatus.AWAITING_PAYMENT
      );
      const totalSpentCents = paidOrders.reduce((s, o) => s + o.totalCents, 0);
      const lastOrder = storeOrders.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];
      const pii = decryptCustomerPii(c);

      return {
        id: c.id,
        name: pii.name,
        email: c.email,
        phone: pii.phone,
        paidOrderCount: paidOrders.length,
        pendingOrderCount: pendingOrders.length,
        totalSpentCents,
        lastOrderAt: lastOrder?.createdAt ?? null,
      };
    })
    .filter((c) => c.paidOrderCount > 0 || c.pendingOrderCount > 0);
}

export async function getCharges(storeId: string) {
  const orders = await prisma.order.findMany({
    where: {
      storeId,
      OR: [
        { status: OrderStatus.AWAITING_PIX },
        { payment: { isNot: null } },
      ],
    },
    include: { payment: true },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => ({
    orderId: o.id,
    customerName: o.customerName,
    totalCents: o.totalCents,
    orderStatus: o.status,
    paymentStatus: o.payment?.status ?? null,
    paidAt: o.payment?.paidAt ?? null,
    createdAt: o.createdAt,
    pixExpiresAt: o.pixExpiresAt,
  }));
}

export async function syncPayableStatuses(storeId: string) {
  const now = new Date();
  await prisma.payableAccount.updateMany({
    where: {
      storeId,
      status: PayableStatus.PENDING,
      dueDate: { lt: now },
    },
    data: { status: PayableStatus.OVERDUE },
  });
}
