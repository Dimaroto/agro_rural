import { MovementType, Prisma } from "@prisma/client";
import { prisma } from "./db";
import {
  stockSuffix as formatStockSuffix,
  type StockUnitCode,
} from "./stock-unit";

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export type StockLine = {
  productId: string;
  quantity: number;
};

export function availableStock(product: {
  quantity: number;
  reservedQuantity: number;
}) {
  return product.quantity - product.reservedQuantity;
}

export function sellableStock(product: {
  quantity: number;
  reservedQuantity: number;
}) {
  return Math.max(0, availableStock(product));
}

export function hasBackorder(product: { quantity: number }) {
  return product.quantity < 0;
}

export function maxOrderQuantity(available: number) {
  return Math.max(0, Math.floor(available));
}

export function stockSuffix(
  available: number,
  stockUnit: StockUnitCode | string | null | undefined = "UN"
): string {
  return formatStockSuffix(available, stockUnit);
}

type Tx = Prisma.TransactionClient;

async function resolveProduct(tx: Tx, storeId: string, productId: string) {
  const product = await tx.product.findFirst({
    where: { id: productId, storeId },
  });
  if (!product) throw new InventoryError("Produto não encontrado");
  return product;
}

async function recordMovement(
  tx: Tx,
  params: {
    storeId: string;
    productId: string;
    type: MovementType;
    quantity: number;
    balanceAfter: number;
    note?: string;
    orderId?: string;
  }
) {
  return tx.inventoryMovement.create({ data: params });
}

export async function manualStockIn(
  storeId: string,
  productId: string,
  quantity: number,
  note?: string
) {
  if (quantity <= 0) throw new InventoryError("Quantidade deve ser positiva");

  return prisma.$transaction(async (tx) => {
    const product = await resolveProduct(tx, storeId, productId);
    const newQty = product.quantity + quantity;
    await tx.product.update({
      where: { id: product.id },
      data: { quantity: newQty },
    });
    await recordMovement(tx, {
      storeId,
      productId,
      type: MovementType.MANUAL_IN,
      quantity,
      balanceAfter: newQty,
      note: note ?? "Entrada",
    });
    return newQty;
  });
}

export async function manualStockOut(
  storeId: string,
  productId: string,
  quantity: number,
  note?: string
) {
  if (quantity <= 0) throw new InventoryError("Quantidade deve ser positiva");

  return prisma.$transaction(async (tx) => {
    const product = await resolveProduct(tx, storeId, productId);
    const available = availableStock(product);
    if (available < quantity) {
      throw new InventoryError(`Estoque insuficiente para ${product.name}`);
    }
    const newQty = product.quantity - quantity;
    await tx.product.update({
      where: { id: product.id },
      data: { quantity: newQty },
    });
    await recordMovement(tx, {
      storeId,
      productId,
      type: MovementType.MANUAL_OUT,
      quantity: -quantity,
      balanceAfter: newQty,
      note: note ?? "Saída",
    });
    return newQty;
  });
}

export async function adjustStock(
  storeId: string,
  productId: string,
  newQuantity: number,
  note?: string
) {
  if (newQuantity < 0) throw new InventoryError("Quantidade inválida");

  return prisma.$transaction(async (tx) => {
    const product = await resolveProduct(tx, storeId, productId);
    if (newQuantity < product.reservedQuantity) {
      throw new InventoryError(
        "Quantidade não pode ser menor que o estoque reservado"
      );
    }
    const delta = newQuantity - product.quantity;
    await tx.product.update({
      where: { id: product.id },
      data: { quantity: newQuantity },
    });
    await recordMovement(tx, {
      storeId,
      productId,
      type: MovementType.ADJUSTMENT,
      quantity: delta,
      balanceAfter: newQuantity,
      note: note ?? "Ajuste",
    });
    return newQuantity;
  });
}

export async function reserveStock(
  storeId: string,
  orderId: string,
  items: StockLine[]
) {
  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await resolveProduct(tx, storeId, item.productId);
      const available = availableStock(product);

      if (item.quantity > available) {
        throw new InventoryError(
          available <= 0
            ? `"${product.name}" está esgotado.`
            : `Estoque insuficiente de "${product.name}" (disponível: ${available}).`
        );
      }

      const newReserved = product.reservedQuantity + item.quantity;
      await tx.product.update({
        where: { id: product.id },
        data: { reservedQuantity: newReserved },
      });
      await recordMovement(tx, {
        storeId,
        productId: item.productId,
        type: MovementType.RESERVE,
        quantity: -item.quantity,
        balanceAfter: product.quantity,
        orderId,
        note: `Reserva pedido ${orderId}`,
      });
    }
  });
}

export async function commitReservedStock(
  storeId: string,
  orderId: string,
  items: StockLine[]
) {
  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await resolveProduct(tx, storeId, item.productId);
      const releaseReserved = Math.min(
        item.quantity,
        product.reservedQuantity
      );
      const newReserved = product.reservedQuantity - releaseReserved;
      const deductQty = Math.min(product.quantity, item.quantity);
      const newQty = product.quantity - deductQty;

      await tx.product.update({
        where: { id: product.id },
        data: { quantity: newQty, reservedQuantity: newReserved },
      });
      await recordMovement(tx, {
        storeId,
        productId: item.productId,
        type: MovementType.SALE,
        quantity: -deductQty,
        balanceAfter: newQty,
        orderId,
        note: `Venda pedido ${orderId}`,
      });
    }
  });
}

export async function releaseReservedStock(
  storeId: string,
  orderId: string,
  items: StockLine[]
) {
  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await resolveProduct(tx, storeId, item.productId);
      const releaseQty = Math.min(item.quantity, product.reservedQuantity);
      if (releaseQty <= 0) continue;
      const newReserved = product.reservedQuantity - releaseQty;
      await tx.product.update({
        where: { id: product.id },
        data: { reservedQuantity: newReserved },
      });
      await recordMovement(tx, {
        storeId,
        productId: item.productId,
        type: MovementType.RELEASE,
        quantity: releaseQty,
        balanceAfter: product.quantity,
        orderId,
        note: `Liberação pedido ${orderId}`,
      });
    }
  });
}

export async function replenishBackorderOnDelivery(
  storeId: string,
  orderId: string,
  items: StockLine[],
  options?: { noteSuffix?: string }
) {
  const noteSuffix = options?.noteSuffix ? ` ${options.noteSuffix}` : "";
  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await resolveProduct(tx, storeId, item.productId);
      const backorder = Math.max(0, -product.quantity);
      if (backorder <= 0) continue;
      const addQty = Math.min(item.quantity, backorder);
      if (addQty <= 0) continue;
      const newQty = product.quantity + addQty;
      await tx.product.update({
        where: { id: product.id },
        data: { quantity: newQty },
      });
      await recordMovement(tx, {
        storeId,
        productId: item.productId,
        type: MovementType.MANUAL_IN,
        quantity: addQty,
        balanceAfter: newQty,
        orderId,
        note: `Confecção entregue pedido ${orderId}${noteSuffix}`,
      });
    }
  });
}

export async function restoreSoldStock(
  storeId: string,
  orderId: string,
  items: StockLine[]
) {
  return prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await resolveProduct(tx, storeId, item.productId);
      const newQty = product.quantity + item.quantity;
      await tx.product.update({
        where: { id: product.id },
        data: { quantity: newQty },
      });
      await recordMovement(tx, {
        storeId,
        productId: item.productId,
        type: MovementType.CANCEL,
        quantity: item.quantity,
        balanceAfter: newQty,
        orderId,
        note: `Estorno pedido ${orderId}`,
      });
    }
  });
}
