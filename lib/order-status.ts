import { OrderStatus } from "@prisma/client";
import type { OrderStatus as OrderStatusType } from "@prisma/client";

/** Valores literais — estáveis no dev mesmo com cache antigo do enum Prisma após mudanças no schema. */
export const ORDER_STATUS = {
  DRAFT: "DRAFT",
  AWAITING_PIX: "AWAITING_PIX",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  PAID: "PAID",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const satisfies Record<string, OrderStatusType>;

/** Status que contam como venda concluída (PAID + DELIVERED quando o client já foi regenerado). */
export function completedSaleStatuses(): OrderStatusType[] {
  const statuses: OrderStatusType[] = [OrderStatus.PAID];
  if (OrderStatus.DELIVERED) statuses.push(OrderStatus.DELIVERED);
  return statuses;
}
