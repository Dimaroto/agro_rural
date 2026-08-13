"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { formatPrice } from "@/lib/format";
import { formatApiError } from "@/lib/apiError";
import {
  formatOrderSummary,
  ORDER_STATUS_LABELS,
} from "@/lib/order-admin-shared";
import { formatOrderCode } from "@/lib/order-number";

type OrderItem = {
  id: string;
  quantity: number;
  productName: string;
  optionsJson: string | null;
};

type OrderCardProps = {
  order: {
    id: string;
    orderNumber?: number | null;
    status: OrderStatus;
    totalCents: number;
    customerName: string | null;
    customerPhone: string | null;
    createdAt?: Date | string;
    receivableDueAt?: Date | string | null;
    items: OrderItem[];
    payment: {
      status: string;
      provider: string;
      method?: string | null;
    } | null;
  };
  storeWhatsapp: string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Dias restantes até a data (mínimo 0). */
function daysRemainingUntil(due: Date): number {
  const end = new Date(due);
  end.setHours(23, 59, 59, 999);
  const ms = end.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function OrderCard({ order, storeWhatsapp }: OrderCardProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const orderCode = formatOrderCode(order.orderNumber, order.id);

  const summary = formatOrderSummary(order);
  const paymentPending = order.payment?.status === "PENDING";
  const isCash = order.payment?.method === "cash";
  const isReceivableMethod = order.payment?.method === "receivable";
  const isManualReceive = isCash || isReceivableMethod;

  const isAwaitingReceive =
    paymentPending &&
    isManualReceive &&
    (order.status === OrderStatus.AWAITING_PAYMENT ||
      order.status === OrderStatus.DELIVERED);

  /** Pendência de entrega: sempre visível até marcar entregue. */
  const canDeliver =
    order.status === OrderStatus.PAID ||
    (order.status === OrderStatus.AWAITING_PAYMENT && isManualReceive);

  /** Pendência de recebimento: sempre visível até confirmar, independente da entrega. */
  const canConfirmPayment = isAwaitingReceive;

  const canCancel =
    order.status === OrderStatus.AWAITING_PIX ||
    order.status === OrderStatus.AWAITING_PAYMENT ||
    order.status === OrderStatus.PAID ||
    order.status === OrderStatus.DRAFT ||
    (order.status === OrderStatus.DELIVERED &&
      paymentPending &&
      isManualReceive);

  const receivableDue = toDate(order.receivableDueAt);

  const receivableDaysLeft =
    receivableDue && paymentPending ? daysRemainingUntil(receivableDue) : null;

  const showReceberPrazo = receivableDaysLeft != null;

  const receberPrazoLabel = showReceberPrazo
    ? `A receber · ${receivableDaysLeft} dia${receivableDaysLeft === 1 ? "" : "s"}`
    : null;

  const receberDueDateLabel =
    showReceberPrazo && receivableDue
      ? receivableDue.toLocaleDateString("pt-BR")
      : null;

  const statusLabel =
    order.status === OrderStatus.DELIVERED &&
    paymentPending &&
    isManualReceive
      ? showReceberPrazo
        ? "Entregue"
        : "Entregue · A receber"
      : isAwaitingReceive && order.status === OrderStatus.AWAITING_PAYMENT
        ? "A receber"
        : ORDER_STATUS_LABELS[order.status];

  const paymentLabel = isAwaitingReceive
    ? "A receber"
    : order.payment?.method === "pix"
      ? "PIX"
      : order.payment?.method === "card"
        ? "Cartão"
        : order.payment?.method === "cash"
          ? "Dinheiro"
          : order.payment?.method === "receivable"
            ? "A receber"
            : order.payment?.method === "delivered"
              ? "Entregue"
              : order.payment?.method ?? null;

  const statusBadgeReceivable =
    isAwaitingReceive ||
    (order.status === OrderStatus.DELIVERED &&
      paymentPending &&
      isManualReceive);

  /** Evita badge "A receber" duplicado quando já há o prazo detalhado. */
  const showStatusBadge = !(showReceberPrazo && statusLabel === "A receber");

  async function runAction(action: "deliver" | "cancel" | "confirm_payment") {
    setLoadingAction(action);
    setError("");
    setMessage("");

    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setLoadingAction(null);

    if (!res.ok) {
      setError(formatApiError(data.error, "Erro ao atualizar pedido"));
      return;
    }

    setMessage(
      action === "deliver"
        ? "Pedido marcado como entregue."
        : action === "confirm_payment"
          ? "Recebimento confirmado."
          : "Pedido cancelado."
    );
    router.refresh();
  }

  async function resendSummary() {
    setError("");
    setMessage("");

    try {
      await navigator.clipboard.writeText(summary);
      setMessage("Resumo copiado para a área de transferência.");
    } catch {
      setMessage("");
    }

    const phone =
      order.customerPhone?.replace(/\D/g, "") ||
      storeWhatsapp?.replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`
      : `https://wa.me/?text=${encodeURIComponent(summary)}`;

    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <li id={`order-${order.id}`} className="admin-card scroll-mt-24 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-sm font-semibold text-[#2D4C1E] dark:text-zinc-300">
            {orderCode}
          </span>
          {order.customerName && (
            <p className="mt-0.5 text-sm text-[#6b7280] dark:text-zinc-400">
              {order.customerName}
              {order.customerPhone ? ` · ${order.customerPhone}` : ""}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {showStatusBadge && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                statusBadgeReceivable
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                  : "bg-[#E4EAD8] text-[#2D4C1E] dark:bg-zinc-800 dark:text-zinc-200"
              }`}
            >
              {statusLabel}
            </span>
          )}
          {receberPrazoLabel && (
            <span
              className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
              title={
                receberDueDateLabel
                  ? `Vence em ${receberDueDateLabel}`
                  : undefined
              }
            >
              {receberPrazoLabel}
              {receberDueDateLabel ? ` · ${receberDueDateLabel}` : ""}
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 font-bold text-emerald-700 dark:text-emerald-400">
        {formatPrice(order.totalCents)}
      </p>

      <ul className="mt-2 space-y-1.5 text-sm text-[#6b7280] dark:text-zinc-400">
        {order.items.map((item) => (
            <li key={item.id}>
              <span>
                {item.quantity}x {item.productName}
              </span>
            </li>
          ))}
      </ul>

      {order.payment && (
        <p className="mt-2 text-xs text-[#6b7280] dark:text-zinc-500">
          Pagamento: {paymentLabel ?? order.payment.status}
          {paymentLabel ? ` · ${order.payment.status}` : ""}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canDeliver && (
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => runAction("deliver")}
            className="inline-flex min-h-[2.75rem] cursor-pointer items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50 md:min-h-0 dark:bg-sky-700 dark:hover:bg-sky-600"
          >
            {loadingAction === "deliver" ? "Salvando..." : "Marcar entregue"}
          </button>
        )}
        {canConfirmPayment && (
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => runAction("confirm_payment")}
            className="inline-flex min-h-[2.75rem] cursor-pointer items-center justify-center rounded-xl bg-amber-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50 md:min-h-0 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            {loadingAction === "confirm_payment"
              ? "Confirmando..."
              : "Confirmar recebimento"}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => runAction("cancel")}
            className="min-h-[2.75rem] rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 md:min-h-0 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            {loadingAction === "cancel" ? "Cancelando..." : "Cancelar"}
          </button>
        )}
        <button
          type="button"
          onClick={resendSummary}
          className="admin-btn-secondary min-h-[2.75rem] px-3 py-2 text-xs md:min-h-0"
        >
          Reenviar resumo
        </button>
      </div>

      {message && (
        <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </li>
  );
}
