"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { formatApiError } from "@/lib/apiError";
import type { PdvPaymentMethod, PdvProductListItem } from "@/lib/pdv-shared";
import { PDV_PAYMENT_LABELS } from "@/lib/pdv-shared";
import type { PartyFavorFieldAnswer } from "@/lib/party-favor-fields";
import { maxOrderQuantity, stockSuffix } from "@/lib/inventory";
import { PdvInstallButton } from "@/components/admin/PdvInstallButton";
import { PdvNotifications } from "@/components/admin/PdvNotifications";

type SheetMode = "menu" | "sell" | "stock";
type Mode = SheetMode | null;

const paymentLabels = PDV_PAYMENT_LABELS;

export function PdvClient() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<PdvProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState<PdvProductListItem | null>(null);
  const [mode, setMode] = useState<Mode>(null);

  const loadProducts = useCallback(async (q: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/pdv/products?q=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.error, "Erro ao buscar produtos"));
        setProducts([]);
        return;
      }
      setProducts(data.products ?? []);
    } catch {
      setError("Não foi possível carregar os produtos.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => {
      void loadProducts(query);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, loadProducts]);

  function closeSheet() {
    setSelected(null);
    setMode(null);
  }

  function refreshAfterAction(message: string) {
    setSuccess(message);
    closeSheet();
    void loadProducts(query);
    window.setTimeout(() => setSuccess(""), 4000);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            PDV
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Venda presencial e ajuste de estoque
          </p>
        </div>
        <PdvInstallButton />
      </header>

      <PdvNotifications />

      <div className="admin-card p-3 sm:p-4">
        <label className="sr-only" htmlFor="pdv-search">
          Buscar produto
        </label>
        <div className="relative">
          <input
            id="pdv-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="admin-input w-full px-4 py-3 pr-28 text-base"
            placeholder="Buscar por código ou nome…"
            autoComplete="off"
            autoFocus
            aria-busy={loading}
          />
          {loading && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
                aria-hidden
              />
              Buscando…
            </span>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
          {success}
        </p>
      )}

      <div className="relative">
        {loading && products.length > 0 && (
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900/95 dark:text-zinc-300 dark:ring-zinc-700">
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
                aria-hidden
              />
              Atualizando lista…
            </span>
          </div>
        )}

        <ul
          className={`admin-card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800 ${
            loading ? "opacity-70" : ""
          }`}
          aria-busy={loading}
        >
          {loading && products.length === 0 ? (
            <li className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-sm text-zinc-500">
              <span
                className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
                aria-hidden
              />
              Carregando produtos…
            </li>
          ) : products.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-zinc-500">
              Nenhum produto encontrado
            </li>
          ) : (
            products.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(product);
                    setMode("menu");
                    setError("");
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-900/60 dark:active:bg-zinc-900 touch-manipulation"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {product.codeLabel}
                    </p>
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Estoque: {product.available}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-zinc-800 dark:text-zinc-200">
                    {formatPrice(product.priceCents)}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {selected && mode && (
        <PdvSheet
          product={selected}
          mode={mode}
          onModeChange={setMode}
          onClose={closeSheet}
          onSold={(msg) => refreshAfterAction(msg)}
          onStockAdjusted={(msg) => refreshAfterAction(msg)}
          onError={setError}
        />
      )}
    </div>
  );
}

function PdvSheet({
  product,
  mode,
  onModeChange,
  onClose,
  onSold,
  onStockAdjusted,
  onError,
}: {
  product: PdvProductListItem;
  mode: SheetMode;
  onModeChange: (mode: SheetMode) => void;
  onClose: () => void;
  onSold: (message: string) => void;
  onStockAdjusted: (message: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/40"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl dark:bg-zinc-950 sm:rounded-3xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {product.codeLabel}
            </p>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {product.name}
            </h2>
            <p className="text-sm text-zinc-500">
              {formatPrice(product.priceCents)} · Estoque {product.available}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Fechar
          </button>
        </div>

        {mode === "menu" && (
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => onModeChange("sell")}
              disabled={product.available <= 0}
              className="admin-btn-primary min-h-12 w-full text-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              {product.available <= 0 ? "Esgotado" : "Vender"}
            </button>
            <button
              type="button"
              onClick={() => onModeChange("stock")}
              className="admin-btn-secondary min-h-12 w-full text-base"
            >
              Ajustar estoque
            </button>
          </div>
        )}

        {mode === "sell" && (
          <SellForm
            product={product}
            onBack={() => onModeChange("menu")}
            onSold={onSold}
            onError={onError}
          />
        )}

        {mode === "stock" && (
          <StockForm
            product={product}
            onBack={() => onModeChange("menu")}
            onAdjusted={onStockAdjusted}
            onError={onError}
          />
        )}
      </div>
    </div>
  );
}

function SellForm({
  product,
  onBack,
  onSold,
  onError,
}: {
  product: PdvProductListItem;
  onBack: () => void;
  onSold: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PdvPaymentMethod>("cash");
  const [dueInDays, setDueInDays] = useState(7);
  const [markAsDelivered, setMarkAsDelivered] = useState(false);
  const [answers, setAnswers] = useState<Record<string, PartyFavorFieldAnswer>>(
    {}
  );
  const [submitting, setSubmitting] = useState(false);

  const maxQty = maxOrderQuantity(product.available);
  const outOfStock = maxQty <= 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    if (outOfStock) {
      onError(`"${product.name}" está esgotado.`);
      return;
    }

    if (quantity > maxQty) {
      onError(`Quantidade máxima: ${maxQty}.`);
      return;
    }

    for (const field of product.customizationFields) {
      if (!field.required) continue;
      const value = answers[field.id]?.value?.trim();
      if (!value) {
        onError(`Preencha o campo "${field.label}".`);
        return;
      }
    }

    if (paymentMethod === "receivable" && (!Number.isInteger(dueInDays) || dueInDays < 1)) {
      onError("Informe o prazo em dias para receber (mínimo 1).");
      return;
    }

    setSubmitting(true);
    onError("");
    try {
      const res = await fetch("/api/admin/pdv/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          paymentMethod,
          dueInDays: paymentMethod === "receivable" ? dueInDays : undefined,
          markAsDelivered,
          fieldAnswers: Object.values(answers).filter((a) => a.value.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(formatApiError(data.error, "Erro ao registrar venda"));
        return;
      }
      const dueLabel =
        paymentMethod === "receivable" && data.dueInDays
          ? ` · receber em ${data.dueInDays} dia(s)`
          : "";
      const deliveredLabel = data.markAsDelivered ? " · Entregue" : "";
      onSold(
        `Venda ${data.orderCode} · ${quantity}x ${product.name} · ${paymentLabels[paymentMethod]}${dueLabel}${deliveredLabel} · ${formatPrice(data.totalCents)}`
      );
    } catch {
      onError("Não foi possível registrar a venda.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-zinc-500 hover:underline cursor-pointer"
      >
        ← Voltar
      </button>

      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Quantidade
        </label>
        <input
          type="number"
          min={1}
          max={Math.max(1, maxQty)}
          value={quantity}
          onChange={(e) =>
            setQuantity(
              Math.min(
                Math.max(1, maxQty),
                Math.max(1, Number(e.target.value) || 1)
              )
            )
          }
          disabled={outOfStock}
          className="admin-input mt-1.5 w-full px-3 py-2.5 text-base"
          required
        />
      </div>

      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Forma de pagamento
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(paymentLabels) as PdvPaymentMethod[]).map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => setPaymentMethod(method)}
              className={`min-h-11 cursor-pointer rounded-xl border text-sm font-semibold transition-colors ${
                paymentMethod === method
                  ? method === "receivable"
                    ? "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200"
                    : "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              {paymentLabels[method]}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMarkAsDelivered((v) => !v)}
        className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors ${
          markAsDelivered
            ? "cursor-pointer border-sky-500 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-300"
            : "cursor-pointer border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
        }`}
      >
        {markAsDelivered ? "✓ Entregue" : "Marcar como entregue"}
      </button>

      {markAsDelivered && (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-900">
          O pedido será registrado já como <strong>Entregue</strong> na aba
          Pedidos
          {paymentMethod === "receivable"
            ? ", mantendo o status A receber até confirmar o pagamento."
            : "."}
        </p>
      )}

      {paymentMethod === "receivable" && (
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Prazo para receber (dias)
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={dueInDays}
            onChange={(e) =>
              setDueInDays(Math.max(1, Number(e.target.value) || 1))
            }
            className="admin-input mt-1.5 w-full px-3 py-2.5 text-base"
            required
          />
          <p className="mt-1 text-xs text-zinc-500">
            O pedido ficará em &quot;A receber&quot; até você confirmar o
            pagamento.
          </p>
        </div>
      )}

      {outOfStock && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800 ring-1 ring-inset ring-red-200">
          Produto esgotado. Ajuste o estoque antes de vender.
        </p>
      )}
      <p className="text-xs text-zinc-500">
        Estoque{stockSuffix(product.available)}
      </p>

      {product.customizationFields.map((field) => (
        <div key={field.id}>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {field.label}
            {field.required ? " *" : ""}
          </label>
          {field.type === "TEXT" ? (
            <input
              value={answers[field.id]?.value ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [field.id]: {
                    fieldId: field.id,
                    fieldLabel: field.label,
                    type: "TEXT",
                    value: e.target.value,
                  },
                }))
              }
              className="admin-input mt-1.5 w-full px-3 py-2.5 text-base"
              required={field.required}
            />
          ) : (
            <select
              value={answers[field.id]?.optionId ?? ""}
              onChange={(e) => {
                const option = field.options.find((o) => o.id === e.target.value);
                setAnswers((prev) => ({
                  ...prev,
                  [field.id]: {
                    fieldId: field.id,
                    fieldLabel: field.label,
                    type: "SELECT",
                    optionId: option?.id,
                    value: option?.label ?? "",
                  },
                }));
              }}
              className="admin-input mt-1.5 w-full px-3 py-2.5 text-base"
              required={field.required}
            >
              <option value="">Selecione…</option>
              {field.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}

      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
        Total: {formatPrice(product.priceCents * quantity)}
      </p>

      <button
        type="submit"
        disabled={submitting || outOfStock}
        className="admin-btn-primary min-h-12 w-full text-base disabled:opacity-50"
      >
        {submitting
          ? "Registrando…"
          : markAsDelivered
            ? "Confirmar entrega"
            : "Confirmar venda"}
      </button>
    </form>
  );
}

function StockForm({
  product,
  onBack,
  onAdjusted,
  onError,
}: {
  product: PdvProductListItem;
  onBack: () => void;
  onAdjusted: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [action, setAction] = useState<"in" | "out" | "adjust">("in");
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    onError("");
    try {
      const res = await fetch(`/api/admin/inventory/${product.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: action,
          quantity,
          note: "Ajuste via PDV",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(formatApiError(data.error, "Erro ao ajustar estoque"));
        return;
      }
      onAdjusted(
        `Estoque de ${product.name} atualizado: ${data.balance} un.`
      );
    } catch {
      onError("Não foi possível ajustar o estoque.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="cursor-pointer text-sm text-zinc-500 hover:underline"
      >
        ← Voltar
      </button>

      <p className="text-sm text-zinc-500">
        Estoque atual{stockSuffix(product.available)}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["in", "Adicionar"],
            ["out", "Remover"],
            ["adjust", "Definir"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setAction(value);
              setQuantity(
                value === "adjust" ? product.available : 1
              );
            }}
            className={`min-h-11 cursor-pointer rounded-xl border text-sm font-semibold ${
              action === value
                ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {action === "adjust" ? "Quantidade disponível" : "Quantidade"}
        </label>
        <input
          type="number"
          min={action === "adjust" ? 0 : 1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value) || 0)}
          className="admin-input mt-1.5 w-full px-3 py-2.5 text-base"
          required
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="admin-btn-primary min-h-12 w-full cursor-pointer text-base disabled:opacity-50"
      >
        {submitting ? "Salvando…" : "Salvar estoque"}
      </button>
    </form>
  );
}
