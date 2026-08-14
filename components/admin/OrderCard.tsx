"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { formatPrice } from "@/lib/format";
import { formatApiError } from "@/lib/apiError";
import {
  formatOrderSummary,
  ORDER_STATUS_LABELS,
} from "@/lib/order-admin-shared";
import { formatOrderCode } from "@/lib/order-number";
import { CurrencyInput } from "@/components/admin/CurrencyInput";
import {
  PDV_PAYMENT_LABELS,
  type PdvCustomerListItem,
  type PdvPaymentMethod,
} from "@/lib/pdv-shared";

type OrderItem = {
  id: string;
  quantity: number;
  productName: string;
  unitPriceCents: number;
  optionsJson: string | null;
};

type OrderCardProps = {
  order: {
    id: string;
    orderNumber?: number | null;
    status: OrderStatus;
    totalCents: number;
    discountCents?: number;
    customerId?: string | null;
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
  const [editing, setEditing] = useState(false);
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

  const canDeliver =
    order.status === OrderStatus.PAID ||
    (order.status === OrderStatus.AWAITING_PAYMENT && isManualReceive);

  const canConfirmPayment = isAwaitingReceive;

  const isClosed =
    order.status === OrderStatus.CANCELLED ||
    order.status === OrderStatus.EXPIRED;

  const canCancel = !isClosed;
  const canEdit = !isClosed;

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

  const showStatusBadge = !(showReceberPrazo && statusLabel === "A receber");

  const subtotalCents = order.items.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0
  );
  const discountCents = order.discountCents ?? 0;

  async function runAction(action: "deliver" | "cancel" | "confirm_payment") {
    if (action === "cancel") {
      const ok = window.confirm(
        `Cancelar a venda ${orderCode}? O estoque será estornado.`
      );
      if (!ok) return;
    }
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
      setError(formatApiError(data.error, "Erro ao atualizar venda"));
      return;
    }

    setMessage(
      action === "deliver"
        ? "Venda marcada como entregue."
        : action === "confirm_payment"
          ? "Recebimento confirmado."
          : "Venda cancelada."
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

      {discountCents > 0 ? (
        <div className="mt-2 space-y-0.5 text-sm">
          <p className="text-zinc-500">Subtotal {formatPrice(subtotalCents)}</p>
          <p className="text-zinc-500">Desconto {formatPrice(discountCents)}</p>
          <p className="font-bold text-emerald-700 dark:text-emerald-400">
            Total {formatPrice(order.totalCents)}
          </p>
        </div>
      ) : (
        <p className="mt-2 font-bold text-emerald-700 dark:text-emerald-400">
          {formatPrice(order.totalCents)}
        </p>
      )}

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

      {editing && canEdit && (
        <SaleEditForm
          order={order}
          subtotalCents={subtotalCents}
          onCancel={() => setEditing(false)}
          onSaved={(msg) => {
            setEditing(false);
            setMessage(msg);
            router.refresh();
          }}
          onError={setError}
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canEdit && !editing && (
          <button
            type="button"
            disabled={loadingAction !== null}
            onClick={() => {
              setError("");
              setMessage("");
              setEditing(true);
            }}
            className="admin-btn-secondary min-h-[2.75rem] px-3 py-2 text-xs md:min-h-0"
          >
            Alterar
          </button>
        )}
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

function SaleEditForm({
  order,
  subtotalCents,
  onCancel,
  onSaved,
  onError,
}: {
  order: OrderCardProps["order"];
  subtotalCents: number;
  onCancel: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const initialDiscount = Math.min(order.discountCents ?? 0, subtotalCents);
  const [discountCents, setDiscountCents] = useState(initialDiscount);
  const [percent, setPercent] = useState(
    subtotalCents > 0
      ? String(((initialDiscount / subtotalCents) * 100).toFixed(2))
      : "0"
  );
  const [paymentMethod, setPaymentMethod] = useState<PdvPaymentMethod>(
    (order.payment?.method as PdvPaymentMethod) || "cash"
  );
  const [dueInDays, setDueInDays] = useState(7);
  const [customer, setCustomer] = useState<PdvCustomerListItem | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<PdvCustomerListItem[]>(
    []
  );
  const [clearCustomer, setClearCustomer] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalCents = subtotalCents - discountCents;
  const paymentLabels = PDV_PAYMENT_LABELS;

  useEffect(() => {
    const q = customerQuery.trim();
    if (q.length < 1) {
      setCustomerResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/customers?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        if (res.ok) setCustomerResults(data.customers ?? []);
      } catch {
        setCustomerResults([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);

  function applyPercent(raw: string) {
    setPercent(raw);
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    const p = Math.min(100, n);
    setDiscountCents(Math.round((subtotalCents * p) / 100));
  }

  function applyTotal(cents: number) {
    const next = Math.min(subtotalCents, Math.max(0, cents));
    setDiscountCents(subtotalCents - next);
    setPercent(
      subtotalCents > 0
        ? (((subtotalCents - next) / subtotalCents) * 100).toFixed(2)
        : "0"
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    onError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          discountCents,
          paymentMethod:
            paymentMethod !== (order.payment?.method ?? "")
              ? paymentMethod
              : undefined,
          dueInDays:
            paymentMethod !== (order.payment?.method ?? "") &&
            paymentMethod === "receivable"
              ? dueInDays
              : undefined,
          customerId: clearCustomer
            ? null
            : customer
              ? customer.id
              : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(formatApiError(data.error, "Erro ao alterar venda"));
        return;
      }
      onSaved("Venda atualizada.");
    } catch {
      onError("Não foi possível alterar a venda.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-4 space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
    >
      <p className="text-sm font-semibold">Alterar venda</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">
          Desconto %
          <input
            value={percent}
            onChange={(e) => applyPercent(e.target.value)}
            inputMode="decimal"
            className="admin-input mt-1 w-full px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs font-medium">
          Total
          <CurrencyInput
            valueCents={totalCents}
            onChange={applyTotal}
            className="admin-input mt-1 w-full px-3 py-2 text-sm"
            aria-label="Total da venda"
          />
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        Subtotal {formatPrice(subtotalCents)} · Desconto{" "}
        {formatPrice(discountCents)}
      </p>

      <div>
        <p className="text-xs font-medium">Cliente</p>
        {customer ? (
          <div className="mt-1 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm">
            <span>{customer.name}</span>
            <button
              type="button"
              className="text-xs hover:underline"
              onClick={() => setCustomer(null)}
            >
              Trocar
            </button>
          </div>
        ) : (
          <>
            <p className="mt-1 text-xs text-zinc-500">
              Atual: {order.customerName ?? "sem cliente"}
              {clearCustomer ? " (será removido)" : ""}
            </p>
            <input
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Buscar para trocar…"
              className="admin-input mt-1 w-full px-3 py-2 text-sm"
            />
            {customerResults.length > 0 && (
              <ul className="mt-1 max-h-28 overflow-y-auto rounded-lg border text-sm">
                {customerResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-zinc-50"
                      onClick={() => {
                        setCustomer(c);
                        setClearCustomer(false);
                        setCustomerQuery("");
                        setCustomerResults([]);
                      }}
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {order.customerId && (
              <button
                type="button"
                className="mt-1 text-xs text-red-600 hover:underline"
                onClick={() => {
                  setClearCustomer(true);
                  setCustomer(null);
                }}
              >
                Remover cliente
              </button>
            )}
          </>
        )}
      </div>

      <div>
        <p className="text-xs font-medium">Pagamento</p>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(paymentLabels) as PdvPaymentMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`min-h-9 rounded-lg border text-xs font-semibold ${
                paymentMethod === method
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200"
              }`}
            >
              {paymentLabels[method]}
            </button>
          ))}
        </div>
      </div>

      {paymentMethod === "receivable" && (
        <label className="text-xs font-medium">
          Prazo (dias)
          <input
            type="number"
            min={1}
            value={dueInDays}
            onChange={(e) =>
              setDueInDays(Math.max(1, Number(e.target.value) || 1))
            }
            className="admin-input mt-1 w-full px-3 py-2 text-sm"
          />
        </label>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="admin-btn-primary text-sm"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="admin-btn-secondary text-sm"
        >
          Fechar
        </button>
      </div>
    </form>
  );
}
