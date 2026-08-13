import { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "./db";
import {
  availableStock,
  commitReservedStock,
  InventoryError,
  reserveStock,
} from "./inventory";
import {
  buildOrderItems,
  loadOrderProducts,
  type OrderItemInput,
} from "./orders";
import { allocateOrderNumber, formatOrderCode } from "./order-number";
import {
  formatProductCode,
  parseProductCodeQuery,
} from "./product-code";
import {
  productFieldsInclude,
  projectProductFields,
} from "./product-fields-persist";
import type { PartyFavorFieldAnswer } from "./party-favor-fields";
import { notifyStockLevel } from "./admin-push-dispatch";

export type { PdvPaymentMethod, PdvProductListItem } from "./pdv-shared";
export { PDV_PAYMENT_LABELS } from "./pdv-shared";

import type { PdvPaymentMethod, PdvProductListItem } from "./pdv-shared";

export async function listPdvProducts(
  storeId: string,
  query?: string
): Promise<PdvProductListItem[]> {
  const q = query?.trim() ?? "";
  const code = q ? parseProductCodeQuery(q) : null;

  const products = await prisma.product.findMany({
    where: {
      storeId,
      active: true,
      ...(q
        ? {
            OR: [
              ...(code != null ? [{ code }] : []),
              { name: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: productFieldsInclude,
    orderBy: [{ code: "asc" }, { name: "asc" }],
    take: 80,
  });

  return products.map((p) => {
    const available = availableStock(p);
    return {
      id: p.id,
      code: p.code,
      codeLabel: formatProductCode(p.code),
      name: p.name,
      priceCents: p.priceCents,
      available,
      imageUrl: p.imageUrl,
      customizationFields: projectProductFields(p.customizationFields),
    };
  });
}

export async function createWalkInSale(params: {
  storeId: string;
  productId: string;
  quantity: number;
  paymentMethod: PdvPaymentMethod;
  /** Prazo em dias para receber (obrigatório quando paymentMethod = receivable). */
  dueInDays?: number;
  /** Marca o pedido como Entregue (pode combinar com qualquer forma de pagamento). */
  markAsDelivered?: boolean;
  fieldAnswers?: PartyFavorFieldAnswer[];
  notes?: string;
}) {
  if (params.quantity <= 0) {
    throw new InventoryError("Quantidade deve ser positiva");
  }

  const isReceivable = params.paymentMethod === "receivable";
  const isDelivered = Boolean(params.markAsDelivered);
  if (isReceivable) {
    const days = params.dueInDays ?? 0;
    if (!Number.isInteger(days) || days < 1) {
      throw new InventoryError("Informe o prazo em dias para receber (mínimo 1).");
    }
  }

  const productRow = await prisma.product.findFirst({
    where: { id: params.productId, storeId: params.storeId, active: true },
    include: productFieldsInclude,
  });
  if (!productRow) {
    throw new InventoryError("Produto não encontrado");
  }

  const availableForSale = availableStock(productRow);
  if (params.quantity > availableForSale) {
    throw new InventoryError(
      availableForSale <= 0
        ? `"${productRow.name}" está esgotado.`
        : `Estoque insuficiente de "${productRow.name}" (disponível: ${availableForSale}).`
    );
  }

  const item: OrderItemInput = {
    productId: params.productId,
    quantity: params.quantity,
    fieldAnswers: params.fieldAnswers,
    notes: params.notes,
  };

  const products = await loadOrderProducts(params.storeId, [item]);
  const orderItems = buildOrderItems([item], products);
  const totalCents = orderItems.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0
  );

  let receivableDueAt: Date | null = null;
  if (isReceivable && params.dueInDays) {
    receivableDueAt = new Date();
    receivableDueAt.setHours(23, 59, 59, 999);
    receivableDueAt.setDate(receivableDueAt.getDate() + params.dueInDays);
  }

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateOrderNumber(tx, params.storeId);
    const created = await tx.order.create({
      data: {
        storeId: params.storeId,
        orderNumber,
        status: isDelivered
          ? OrderStatus.DELIVERED
          : isReceivable
            ? OrderStatus.AWAITING_PAYMENT
            : OrderStatus.PAID,
        customerName: "Venda presencial",
        totalCents,
        receivableDueAt,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    await tx.payment.create({
      data: {
        orderId: created.id,
        provider: "manual",
        method: params.paymentMethod,
        status: isReceivable ? PaymentStatus.PENDING : PaymentStatus.APPROVED,
        paidAt: isReceivable ? null : new Date(),
        externalId: `pdv-${created.id}`,
      },
    });

    return created;
  });

  try {
    const stockLine = {
      productId: params.productId,
      quantity: params.quantity,
    };
    await reserveStock(params.storeId, order.id, [stockLine]);
    await commitReservedStock(params.storeId, order.id, [stockLine]);
  } catch (err) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { orderId: order.id } });
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });
    });
    throw err;
  }

  await notifyStockLevel({
    storeId: params.storeId,
    productId: params.productId,
    eventId: `pdv:${order.id}`,
  });

  return {
    orderId: order.id,
    orderCode: formatOrderCode(order.orderNumber, order.id),
    totalCents,
    paymentMethod: params.paymentMethod,
    markAsDelivered: isDelivered,
    dueInDays: isReceivable ? params.dueInDays : undefined,
    receivableDueAt: receivableDueAt?.toISOString() ?? undefined,
    productName: productRow.name,
    quantity: params.quantity,
  };
}
