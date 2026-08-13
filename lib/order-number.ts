import { prisma } from "./db";

/** Formata o número sequencial do pedido, ex.: PD0001 */
export function formatOrderCode(
  orderNumber: number | null | undefined,
  fallbackId?: string
) {
  if (typeof orderNumber === "number" && orderNumber > 0) {
    return `PD${String(orderNumber).padStart(4, "0")}`;
  }
  if (fallbackId) return `#${fallbackId.slice(-8)}`;
  return "PD----";
}

/** Extrai o número sequencial de buscas como "PD0001", "pd1" ou "1". */
export function parseOrderCodeQuery(query: string): number | null {
  const cleaned = query.trim().toUpperCase().replace(/^#/, "");
  if (!cleaned) return null;
  const match = cleaned.match(/^PD0*(\d+)$/) ?? cleaned.match(/^0*(\d+)$/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Reserva o próximo número sequencial da loja dentro de uma transação. */
export async function allocateOrderNumber(tx: Tx, storeId: string) {
  const store = await tx.store.update({
    where: { id: storeId },
    data: { nextOrderNumber: { increment: 1 } },
    select: { nextOrderNumber: true },
  });
  return store.nextOrderNumber - 1;
}

/** Atribui PD0001, PD0002… aos pedidos antigos que ainda não têm número. */
export async function ensureStoreOrderNumbers(storeId: string) {
  const missing = await prisma.order.count({
    where: { storeId, orderNumber: null },
  });
  if (missing === 0) {
    const max = await prisma.order.aggregate({
      where: { storeId },
      _max: { orderNumber: true },
    });
    const next = (max._max.orderNumber ?? 0) + 1;
    await prisma.store.updateMany({
      where: { id: storeId, nextOrderNumber: { lt: next } },
      data: { nextOrderNumber: next },
    });
    return;
  }

  const [orders, maxAgg] = await Promise.all([
    prisma.order.findMany({
      where: { storeId, orderNumber: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
    prisma.order.aggregate({
      where: { storeId, orderNumber: { not: null } },
      _max: { orderNumber: true },
    }),
  ]);

  let nextNumber = maxAgg._max.orderNumber ?? 0;

  await prisma.$transaction(async (tx) => {
    for (const order of orders) {
      nextNumber += 1;
      await tx.order.update({
        where: { id: order.id },
        data: { orderNumber: nextNumber },
      });
    }

    await tx.store.update({
      where: { id: storeId },
      data: { nextOrderNumber: nextNumber + 1 },
    });
  });
}
