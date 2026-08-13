import { prisma } from "./db";

/** Formata o código do produto, ex.: 0001 */
export function formatProductCode(code: number | null | undefined) {
  if (typeof code === "number" && code > 0) {
    return String(code).padStart(4, "0");
  }
  return "----";
}

/** Extrai número de buscas como "0007", "7" ou "007". */
export function parseProductCodeQuery(query: string): number | null {
  const cleaned = query.trim().replace(/^#/, "");
  if (!cleaned) return null;
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number.parseInt(cleaned, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Reserva o próximo código sequencial da loja dentro de uma transação. */
export async function allocateProductCode(tx: Tx, storeId: string) {
  const store = await tx.store.update({
    where: { id: storeId },
    data: { nextProductCode: { increment: 1 } },
    select: { nextProductCode: true },
  });
  return store.nextProductCode - 1;
}

/** Garante que nextProductCode fique à frente do maior código existente. */
export async function ensureStoreProductCodes(storeId: string) {
  const max = await prisma.product.aggregate({
    where: { storeId },
    _max: { code: true },
  });
  const next = (max._max.code ?? 0) + 1;
  await prisma.store.updateMany({
    where: { id: storeId, nextProductCode: { lt: next } },
    data: { nextProductCode: next },
  });
}
