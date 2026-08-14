import { OrderStatus, PaymentStatus, MovementType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { PublicApiError } from "./public-api-error";
import { formatPrice } from "./format";
import { releaseReservedStock, restoreSoldStock, commitReservedStock } from "./inventory";
import { stockLinesFromOrderItems } from "./customization";
import { ORDER_STATUS } from "./order-status";
import { formatOrderCode } from "./order-number";
import { dispatchAdminNotification } from "./admin-push-dispatch";
import { decryptCustomerPii } from "./customer-field-crypto";
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
    throw new PublicApiError("Venda não encontrada");
  }

  if (
    order.status === ORDER_STATUS.CANCELLED ||
    order.status === ORDER_STATUS.EXPIRED
  ) {
    throw new PublicApiError("Esta venda não pode ser cancelada");
  }

  const items = stockLinesFromOrderItems(order.items);
  const committed = await prisma.inventoryMovement.findFirst({
    where: { orderId: order.id, type: MovementType.SALE },
    select: { id: true },
  });

  if (committed) {
    await restoreSoldStock(storeId, order.id, items);
  } else if (
    order.status === ORDER_STATUS.AWAITING_PIX ||
    order.status === ORDER_STATUS.AWAITING_PAYMENT ||
    order.status === ORDER_STATUS.DRAFT
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
    title: "Venda cancelada",
    body: `${code} · ${formatPrice(order.totalCents)}${order.customerName ? ` · ${order.customerName}` : ""}`,
    url: `/admin/pedidos?q=${encodeURIComponent(code)}`,
    tag: `order-cancelled-${order.id}`,
  });

  return cancelled;
}

export async function adminUpdateSale(
  storeId: string,
  orderId: string,
  input: {
    customerId?: string | null;
    discountCents?: number;
    paymentMethod?: "pix" | "card" | "cash" | "receivable";
    dueInDays?: number;
  }
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: { items: true, payment: true },
  });
  if (!order) throw new PublicApiError("Venda não encontrada");
  if (
    order.status === ORDER_STATUS.CANCELLED ||
    order.status === ORDER_STATUS.EXPIRED
  ) {
    throw new PublicApiError("Não é possível alterar uma venda cancelada ou expirada");
  }

  const subtotalCents = order.items.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0
  );

  let discountCents = order.discountCents;
  if (input.discountCents != null) {
    if (!Number.isInteger(input.discountCents) || input.discountCents < 0) {
      throw new PublicApiError("Desconto inválido");
    }
    if (input.discountCents > subtotalCents) {
      throw new PublicApiError("O desconto não pode ser maior que o subtotal");
    }
    discountCents = input.discountCents;
  }
  const totalCents = subtotalCents - discountCents;

  let customerId = order.customerId;
  let customerName = order.customerName;
  let customerPhone = order.customerPhone;
  if (input.customerId !== undefined) {
    if (!input.customerId) {
      customerId = null;
      customerName = "Venda presencial";
      customerPhone = null;
    } else {
      const row = await prisma.customer.findFirst({
        where: {
          id: input.customerId,
          OR: [{ storeId }, { storeId: null }],
        },
        select: { id: true, name: true, phone: true },
      });
      if (!row) throw new PublicApiError("Cliente não encontrado");
      const pii = decryptCustomerPii(row);
      customerId = row.id;
      customerName = pii.name?.trim() || "Cliente";
      customerPhone = pii.phone;
    }
  }

  const method = input.paymentMethod ?? order.payment?.method ?? undefined;
  if (method === "receivable" && !customerId) {
    throw new PublicApiError("Selecione um cliente para venda a prazo");
  }

  let receivableDueAt = order.receivableDueAt;
  if (method === "receivable") {
    const days = input.dueInDays;
    if (days != null) {
      if (!Number.isInteger(days) || days < 1) {
        throw new PublicApiError("Informe o prazo em dias (mínimo 1)");
      }
      receivableDueAt = new Date();
      receivableDueAt.setHours(23, 59, 59, 999);
      receivableDueAt.setDate(receivableDueAt.getDate() + days);
    } else if (!receivableDueAt) {
      throw new PublicApiError("Informe o prazo em dias para receber");
    }
  } else if (input.paymentMethod && method !== "receivable") {
    receivableDueAt = null;
  }

  let status = order.status;
  let paymentStatus = order.payment?.status ?? PaymentStatus.PENDING;
  let paidAt = order.payment?.paidAt ?? null;
  if (input.paymentMethod) {
    if (method === "pix") {
      status = ORDER_STATUS.AWAITING_PIX;
      paymentStatus = PaymentStatus.PENDING;
      paidAt = null;
    } else if (method === "receivable") {
      status = ORDER_STATUS.AWAITING_PAYMENT;
      paymentStatus = PaymentStatus.PENDING;
      paidAt = null;
    } else {
      status = ORDER_STATUS.DELIVERED;
      paymentStatus = PaymentStatus.APPROVED;
      paidAt = new Date();
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        customerId,
        customerName,
        customerPhone,
        discountCents,
        totalCents,
        receivableDueAt,
        status,
      },
    });
    if (order.payment) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: {
          ...(input.paymentMethod ? { method: input.paymentMethod } : {}),
          status: paymentStatus,
          paidAt,
        },
      });
    }
  });

  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
}
