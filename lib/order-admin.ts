import { OrderStatus, PaymentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { PublicApiError } from "./public-api-error";
import { formatPrice } from "./format";
import { releaseReservedStock, restoreSoldStock, commitReservedStock } from "./inventory";
import { stockLinesFromOrderItems } from "./customization";
import { ORDER_STATUS } from "./order-status";
import { formatOrderCode } from "./order-number";
import { dispatchAdminNotification } from "./admin-push-dispatch";
import {
  ORDER_STATUS_FILTERS,
  type AdminOrderStatusFilter,
} from "./order-admin-shared";

export {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  ORDER_STATUS_FILTERS,
  resolveOrderStatusFilter,
  formatOrderSummary,
} from "./order-admin-shared";
export type { AdminOrderStatusFilter } from "./order-admin-shared";

export function buildAdminOrdersWhere(
  storeId: string,
  statusFilter: AdminOrderStatusFilter,
  query: string,
  orderNumber: number | null
): Prisma.OrderWhereInput {
  const statusConfig = ORDER_STATUS_FILTERS.find((f) => f.id === statusFilter);
  const isOrderCodeSearch = orderNumber != null;

  const where: Prisma.OrderWhereInput = {
    storeId,
    ...(statusFilter === "receivable"
      ? {
          payment: {
            method: { in: ["receivable", "cash"] },
            status: PaymentStatus.PENDING,
          },
          status: {
            in: [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.DELIVERED],
          },
        }
      : {
          ...(statusConfig?.statuses
            ? { status: { in: statusConfig.statuses } }
            : {}),
          ...(statusConfig?.paymentMethods?.length
            ? { payment: { method: { in: statusConfig.paymentMethods } } }
            : {}),
        }),
    // Em "Pendentes", não misturar vendas "a receber" / dinheiro WhatsApp.
    ...(statusFilter === "pending"
      ? {
          OR: [
            { payment: null },
            {
              payment: {
                method: { notIn: ["receivable", "cash"] },
              },
            },
          ],
        }
      : {}),
    ...(query
      ? isOrderCodeSearch
        ? { orderNumber }
        : {
            OR: [
              { id: { contains: query, mode: "insensitive" as const } },
              {
                customerName: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
              {
                customerPhone: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
      : {}),
  };

  return where;
}

export async function adminDeliverOrder(storeId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      storeId,
      status: {
        in: [ORDER_STATUS.PAID, ORDER_STATUS.AWAITING_PAYMENT],
      },
    },
    include: { items: true, payment: true },
  });

  if (!order) {
    throw new PublicApiError("Pedido não encontrado ou não pode ser marcado como entregue");
  }

  const lines = stockLinesFromOrderItems(order.items);

  // Permite entregar antes (ou sem) confirmar o recebimento (dinheiro / a receber).
  if (order.status === ORDER_STATUS.AWAITING_PAYMENT) {
    const method = order.payment?.method;
    if (method !== "cash" && method !== "receivable") {
      throw new PublicApiError(
        "Só pedidos em dinheiro ou a receber podem ser entregues antes do recebimento"
      );
    }
    // Catálogo (dinheiro/WhatsApp): estoque ainda reservado — baixa na entrega.
    // PDV "a receber": estoque já foi baixado na venda.
    if (method === "cash") {
      await commitReservedStock(storeId, orderId, lines);
    }
  }

  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.DELIVERED },
  });
}

/** Confirma pagamento pendente (PDV a receber ou catálogo dinheiro/WhatsApp) → Pago. */
export async function adminConfirmReceivablePayment(
  storeId: string,
  orderId: string
) {
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      storeId,
      status: {
        in: [ORDER_STATUS.AWAITING_PAYMENT, ORDER_STATUS.DELIVERED],
      },
    },
    include: { payment: true, items: true },
  });

  if (!order) {
    throw new PublicApiError("Pedido não encontrado ou já não está aguardando pagamento");
  }

  const method = order.payment?.method;
  if (method !== "receivable" && method !== "cash") {
    throw new PublicApiError("Este pedido não permite confirmação manual de pagamento");
  }

  if (order.payment?.status === PaymentStatus.APPROVED) {
    throw new PublicApiError("Pagamento já confirmado");
  }

  // Já entregue (dinheiro): só confirma o recebimento, mantém status Entregue.
  const alreadyDelivered = order.status === ORDER_STATUS.DELIVERED;

  // Catálogo (dinheiro/WhatsApp) ainda não entregue: estoque só reservado — baixa ao confirmar.
  if (method === "cash" && !alreadyDelivered) {
    await commitReservedStock(
      storeId,
      orderId,
      stockLinesFromOrderItems(order.items)
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { orderId },
      data: {
        status: PaymentStatus.APPROVED,
        paidAt: new Date(),
      },
    });
    if (!alreadyDelivered) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });
    }
  });

  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { payment: true },
  });
}

export async function adminCancelOrder(storeId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: { items: true, payment: true },
  });

  if (!order) {
    throw new PublicApiError("Pedido não encontrado");
  }

  if (
    order.status === ORDER_STATUS.CANCELLED ||
    order.status === ORDER_STATUS.EXPIRED
  ) {
    throw new PublicApiError("Este pedido não pode ser cancelado");
  }

  const isCashDeliveredUnpaid =
    order.status === ORDER_STATUS.DELIVERED &&
    order.payment?.status === PaymentStatus.PENDING &&
    (order.payment?.method === "cash" ||
      order.payment?.method === "receivable");

  if (order.status === ORDER_STATUS.DELIVERED && !isCashDeliveredUnpaid) {
    throw new PublicApiError("Este pedido não pode ser cancelado");
  }

  const items = stockLinesFromOrderItems(order.items);
  const isReceivable =
    order.payment?.method === "receivable" &&
    order.status === ORDER_STATUS.AWAITING_PAYMENT;

  if (
    isReceivable ||
    order.status === ORDER_STATUS.PAID ||
    isCashDeliveredUnpaid
  ) {
    // Estoque já baixado (venda presencial / a receber / entregue sem receber)
    await restoreSoldStock(storeId, order.id, items);
  } else if (
    order.status === ORDER_STATUS.AWAITING_PIX ||
    order.status === ORDER_STATUS.AWAITING_PAYMENT
  ) {
    await releaseReservedStock(storeId, order.id, items);
  }

  const cancelled = await prisma.order.update({
    where: { id: orderId },
    data: { status: ORDER_STATUS.CANCELLED },
  });

  const code = formatOrderCode(order.orderNumber, order.id);
  await dispatchAdminNotification({
    storeId,
    type: "order_cancelled",
    eventId: `admin:${order.id}`,
    title: "Pedido cancelado",
    body: `${code} · ${formatPrice(order.totalCents)}${order.customerName ? ` · ${order.customerName}` : ""}`,
    url: `/admin/pedidos?q=${encodeURIComponent(code)}`,
    tag: `order-cancelled-${order.id}`,
  });

  return cancelled;
}
