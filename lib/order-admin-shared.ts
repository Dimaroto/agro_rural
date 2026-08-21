import type { OrderStatus } from "@prisma/client";
import { formatPrice } from "./format";
import { ORDER_STATUS } from "./order-status";
import { formatOrderCode } from "./order-number";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Rascunho",
  AWAITING_PIX: "Aguardando PIX",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  receivable: "A receber",
  delivered: "Entregue",
};

export type AdminOrderStatusFilter =
  | "all"
  | "pending"
  | "receivable"
  | "delivered"
  | "cancelled";

export const ORDER_STATUS_FILTERS: {
  id: AdminOrderStatusFilter;
  label: string;
  statuses?: OrderStatus[];
  /** Filtro extra por método(s) de pagamento (ex.: a receber). */
  paymentMethods?: string[];
}[] = [
  { id: "all", label: "Todos" },
  {
    id: "pending",
    label: "Pendentes",
    statuses: [
      ORDER_STATUS.DRAFT,
      ORDER_STATUS.AWAITING_PIX,
      ORDER_STATUS.AWAITING_PAYMENT,
    ],
  },
  {
    id: "receivable",
    label: "A receber",
    paymentMethods: ["receivable", "cash"],
  },
  { id: "delivered", label: "Entregues", statuses: [ORDER_STATUS.DELIVERED] },
  { id: "cancelled", label: "Canceladas", statuses: [ORDER_STATUS.CANCELLED, ORDER_STATUS.EXPIRED] },
];

export function resolveOrderStatusFilter(
  value: string | undefined
): AdminOrderStatusFilter {
  if (
    value === "pending" ||
    value === "receivable" ||
    value === "delivered" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "all";
}

type OrderSummaryInput = {
  id: string;
  orderNumber?: number | null;
  customerName: string | null;
  customerPhone: string | null;
  totalCents: number;
  status: OrderStatus;
  items: { quantity: number; productName: string }[];
};

export function formatOrderSummary(order: OrderSummaryInput): string {
  const code = formatOrderCode(order.orderNumber, order.id);
  const lines = [
    `*Venda ${code}*`,
    order.customerName ? `Cliente: ${order.customerName}` : null,
    order.customerPhone ? `Telefone: ${order.customerPhone}` : null,
    "",
    ...order.items.map((item) => `• ${item.quantity}x ${item.productName}`),
    "",
    `Total: ${formatPrice(order.totalCents)}`,
    `Status: ${ORDER_STATUS_LABELS[order.status]}`,
  ];

  return lines.filter((line) => line !== null).join("\n");
}
