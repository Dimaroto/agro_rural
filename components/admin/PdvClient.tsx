"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { formatApiError } from "@/lib/apiError";
import type {
  PdvCustomerListItem,
  PdvPaymentMethod,
  PdvProductListItem,
} from "@/lib/pdv-shared";
import { PDV_PAYMENT_LABELS } from "@/lib/pdv-shared";
import { maxOrderQuantity, stockSuffix } from "@/lib/inventory";
import { isValidBarcode, normalizeBarcode } from "@/lib/product-barcode";
import { PdvInstallButton } from "@/components/admin/PdvInstallButton";
import { PdvNotifications } from "@/components/admin/PdvNotifications";
import { CurrencyInput } from "@/components/admin/CurrencyInput";
import { PixQrCode } from "@/components/cart/PixQrCode";
import { publicConfig } from "@/lib/public-config";

type CartLine = {
  product: PdvProductListItem;
  quantity: number;
};

type PixPending = {
  orderId: string;
  orderCode: string;
  totalCents: number;
};

const paymentLabels = PDV_PAYMENT_LABELS;

export function PdvClient() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<PdvProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [stockProduct, setStockProduct] = useState<PdvProductListItem | null>(
    null
  );

  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<PdvCustomerListItem[]>(
    []
  );
  const [customer, setCustomer] = useState<PdvCustomerListItem | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PdvPaymentMethod>("cash");
  const [receivedCents, setReceivedCents] = useState(0);
  const [dueInDays, setDueInDays] = useState(7);
  const [markAsDelivered, setMarkAsDelivered] = useState(false);
  const [cardConfirmed, setCardConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pixPending, setPixPending] = useState<PixPending | null>(null);
  const [confirmingPix, setConfirmingPix] = useState(false);
  const [lastChangeCents, setLastChangeCents] = useState<number | null>(null);

  const pixKey = publicConfig.pixKey;

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
        return [];
      }
      const list = (data.products ?? []) as PdvProductListItem[];
      setProducts(list);
      return list;
    } catch {
      setError("Não foi possível carregar os produtos.");
      setProducts([]);
      return [];
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
        if (res.ok) {
          setCustomerResults(data.customers ?? []);
        }
      } catch {
        setCustomerResults([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);

  const cartQtyById = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) map.set(line.product.id, line.quantity);
    return map;
  }, [cart]);

  const subtotalCents = cart.reduce(
    (sum, line) => sum + line.product.priceCents * line.quantity,
    0
  );
  const changeCents =
    paymentMethod === "cash" ? receivedCents - subtotalCents : 0;

  function addToCart(product: PdvProductListItem) {
    const inCart = cartQtyById.get(product.id) ?? 0;
    const max = maxOrderQuantity(product.available);
    if (max <= 0) {
      setError(`"${product.name}" está esgotado.`);
      return;
    }
    if (inCart >= max) {
      setError(`Estoque insuficiente de "${product.name}" (máx. ${max}).`);
      return;
    }
    setError("");
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: l.quantity + 1, product }
            : l
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function setLineQty(productId: string, quantity: number) {
    setCart((prev) =>
      prev.flatMap((line) => {
        if (line.product.id !== productId) return [line];
        const max = maxOrderQuantity(line.product.available);
        const next = Math.min(max, Math.max(0, quantity));
        if (next <= 0) return [];
        return [{ ...line, quantity: next }];
      })
    );
  }

  function tryScanAdd(list: PdvProductListItem[], q: string) {
    const barcode = normalizeBarcode(q);
    if (!barcode || !isValidBarcode(barcode)) return false;
    const exact = list.filter((p) => p.barcode === barcode);
    if (exact.length === 1) {
      addToCart(exact[0]);
      setQuery("");
      return true;
    }
    return false;
  }

  function refreshAfterStock(message: string) {
    setSuccess(message);
    setStockProduct(null);
    void loadProducts(query);
    window.setTimeout(() => setSuccess(""), 4000);
  }

  function resetSaleUi() {
    setCart([]);
    setReceivedCents(0);
    setCardConfirmed(false);
    setMarkAsDelivered(false);
    setPaymentMethod("cash");
  }

  async function createCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (savingCustomer) return;
    setSavingCustomer(true);
    setError("");
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          phone: newPhone,
          email: newEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.error, "Erro ao cadastrar cliente"));
        return;
      }
      const created = data.customer as PdvCustomerListItem;
      setCustomer(created);
      setShowNewCustomer(false);
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      setCustomerQuery("");
    } catch {
      setError("Não foi possível cadastrar o cliente.");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function checkout() {
    if (submitting || cart.length === 0) return;

    if (paymentMethod === "cash" && receivedCents < subtotalCents) {
      setError("O valor recebido deve ser igual ou maior que o total.");
      return;
    }
    if (paymentMethod === "pix" && !pixKey) {
      setError("Configure a chave PIX (NEXT_PUBLIC_PIX_KEY) para receber no caixa.");
      return;
    }
    if (paymentMethod === "card" && !cardConfirmed) {
      setError("Confirme o pagamento na maquininha para registrar a venda.");
      return;
    }
    if (paymentMethod === "receivable") {
      if (!customer) {
        setError("Selecione um cliente para venda a prazo.");
        return;
      }
      if (!Number.isInteger(dueInDays) || dueInDays < 1) {
        setError("Informe o prazo em dias (mínimo 1).");
        return;
      }
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pdv/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((l) => ({
            productId: l.product.id,
            quantity: l.quantity,
          })),
          paymentMethod,
          customerId: customer?.id,
          receivedCents:
            paymentMethod === "cash" ? receivedCents : undefined,
          dueInDays: paymentMethod === "receivable" ? dueInDays : undefined,
          markAsDelivered,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.error, "Erro ao registrar venda"));
        return;
      }

      if (paymentMethod === "pix") {
        setPixPending({
          orderId: data.orderId,
          orderCode: data.orderCode,
          totalCents: data.totalCents,
        });
        resetSaleUi();
        void loadProducts("");
        return;
      }

      const dueLabel =
        paymentMethod === "receivable" && data.dueInDays
          ? ` · receber em ${data.dueInDays} dia(s)`
          : "";
      const changeLabel =
        paymentMethod === "cash" && data.changeCents > 0
          ? ` · Troco ${formatPrice(data.changeCents)}`
          : "";
      setLastChangeCents(
        paymentMethod === "cash" ? (data.changeCents ?? 0) : null
      );
      setSuccess(
        `Venda ${data.orderCode} · ${data.itemCount} un. · ${paymentLabels[paymentMethod]}${dueLabel}${changeLabel} · ${formatPrice(data.totalCents)}`
      );
      resetSaleUi();
      void loadProducts(query);
      window.setTimeout(() => {
        setSuccess("");
        setLastChangeCents(null);
      }, 8000);
    } catch {
      setError("Não foi possível registrar a venda.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPix() {
    if (!pixPending || confirmingPix) return;
    setConfirmingPix(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pdv/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: pixPending.orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatApiError(data.error, "Erro ao confirmar PIX"));
        return;
      }
      setSuccess(
        `PIX confirmado · ${data.orderCode} · ${formatPrice(data.totalCents)}`
      );
      setPixPending(null);
      window.setTimeout(() => setSuccess(""), 5000);
    } catch {
      setError("Não foi possível confirmar o PIX.");
    } finally {
      setConfirmingPix(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            PDV
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Caixa: busca, carrinho e pagamento
          </p>
        </div>
        <PdvInstallButton />
      </header>

      <PdvNotifications />

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
      {lastChangeCents != null && lastChangeCents > 0 && (
        <p className="rounded-2xl bg-emerald-600 px-4 py-6 text-center text-3xl font-black text-white">
          Troco {formatPrice(lastChangeCents)}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)] lg:items-start">
        <div className="space-y-3">
          <div className="admin-card p-3 sm:p-4">
            <label className="sr-only" htmlFor="pdv-search">
              Buscar produto
            </label>
            <div className="relative">
              <input
                id="pdv-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void loadProducts(query).then((list) => {
                      tryScanAdd(list, query);
                    });
                  }
                }}
                className="admin-input w-full px-4 py-3 pr-28 text-base"
                placeholder="Nome, código, barras ou categoria…"
                autoComplete="off"
                autoFocus
                aria-busy={loading}
              />
              {loading && (
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-2 text-sm text-zinc-500">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"
                    aria-hidden
                  />
                  Buscando…
                </span>
              )}
            </div>
          </div>

          <ul
            className="admin-card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800"
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
              products.map((product) => {
                const inCart = cartQtyById.get(product.id) ?? 0;
                return (
                  <li key={product.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={product.available <= 0}
                      className="min-w-0 flex-1 cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-900/60"
                    >
                      <p className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {product.codeLabel}
                        {product.barcode ? ` · ${product.barcode}` : ""}
                      </p>
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {product.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {product.categoryName} · Estoque {product.available}
                        {inCart > 0 ? ` · no carrinho ${inCart}` : ""}
                      </p>
                      <p className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-200">
                        {formatPrice(product.priceCents)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockProduct(product)}
                      className="shrink-0 cursor-pointer px-3 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 dark:hover:bg-zinc-900"
                      title="Ajustar estoque"
                    >
                      Estoque
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <aside className="admin-card sticky top-4 space-y-4 p-4 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Carrinho
          </h2>

          {cart.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Clique em um produto à esquerda para adicionar.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cart.map((line) => (
                <li
                  key={line.product.id}
                  className="flex items-center gap-2 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {line.product.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatPrice(line.product.priceCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg border text-lg leading-none"
                      onClick={() =>
                        setLineQty(line.product.id, line.quantity - 1)
                      }
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-semibold">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg border text-lg leading-none"
                      onClick={() =>
                        setLineQty(line.product.id, line.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => setLineQty(line.product.id, 0)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-lg font-bold">
            Total {formatPrice(subtotalCents)}
          </p>

          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Cliente
            </p>
            {customer ? (
              <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate font-semibold">
                  {customer.name}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-zinc-600 hover:underline"
                  onClick={() => setCustomer(null)}
                >
                  Trocar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Buscar cliente…"
                  className="admin-input mt-1 w-full px-3 py-2 text-sm"
                />
                {customerResults.length > 0 && (
                  <ul className="mt-1 max-h-36 overflow-y-auto rounded-xl border border-zinc-200 text-sm dark:border-zinc-700">
                    {customerResults.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                          onClick={() => {
                            setCustomer(c);
                            setCustomerQuery("");
                            setCustomerResults([]);
                          }}
                        >
                          <span className="font-medium">{c.name}</span>
                          {c.phone ? (
                            <span className="block text-xs text-zinc-500">
                              {c.phone}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold text-emerald-700 hover:underline"
                  onClick={() => setShowNewCustomer((v) => !v)}
                >
                  {showNewCustomer ? "Cancelar" : "Novo cliente"}
                </button>
                {showNewCustomer && (
                  <form onSubmit={createCustomer} className="mt-2 space-y-2">
                    <input
                      required
                      minLength={2}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nome *"
                      className="admin-input w-full px-3 py-2 text-sm"
                    />
                    <input
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="Telefone"
                      className="admin-input w-full px-3 py-2 text-sm"
                    />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="E-mail (opcional)"
                      className="admin-input w-full px-3 py-2 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={savingCustomer}
                      className="admin-btn-secondary w-full text-sm"
                    >
                      {savingCustomer ? "Salvando…" : "Cadastrar"}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Forma de pagamento
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(paymentLabels) as PdvPaymentMethod[]).map(
                (method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`min-h-11 cursor-pointer rounded-xl border text-sm font-semibold ${
                      paymentMethod === method
                        ? method === "receivable"
                          ? "border-amber-500 bg-amber-50 text-amber-900"
                          : "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {paymentLabels[method]}
                  </button>
                )
              )}
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div>
              <label className="text-sm font-medium">Valor recebido</label>
              <CurrencyInput
                valueCents={receivedCents}
                onChange={setReceivedCents}
                className="admin-input mt-1.5 w-full px-3 py-2.5 text-base"
                aria-label="Valor recebido"
              />
              <p
                className={`mt-2 text-sm font-semibold ${
                  receivedCents < subtotalCents
                    ? "text-red-600"
                    : "text-emerald-700"
                }`}
              >
                {receivedCents < subtotalCents
                  ? "Valor insuficiente"
                  : `Troco ${formatPrice(Math.max(0, changeCents))}`}
              </p>
            </div>
          )}

          {paymentMethod === "pix" && (
            <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900">
              {pixKey
                ? "Ao finalizar, o QR Code PIX aparece para o cliente pagar. Confirme o pagamento nesta tela."
                : "Chave PIX não configurada. Defina NEXT_PUBLIC_PIX_KEY para receber no caixa."}
            </p>
          )}

          {paymentMethod === "card" && (
            <div className="space-y-2 rounded-xl border border-dashed border-zinc-300 p-3">
              <p className="text-xs text-zinc-500">
                Maquininha — placeholder. Integração (Stone/PagSeguro) em breve.
              </p>
              <button
                type="button"
                onClick={() => setCardConfirmed((v) => !v)}
                className={`min-h-11 w-full rounded-xl border text-sm font-semibold ${
                  cardConfirmed
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 text-zinc-600"
                }`}
              >
                {cardConfirmed
                  ? "✓ Pago na maquininha"
                  : "Confirmar pagamento na maquininha"}
              </button>
            </div>
          )}

          {paymentMethod === "receivable" && (
            <div>
              <label className="text-sm font-medium">
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
              />
              {!customer && (
                <p className="mt-1 text-xs text-amber-700">
                  Cliente obrigatório para venda a prazo.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setMarkAsDelivered((v) => !v)}
            className={`flex min-h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold ${
              markAsDelivered
                ? "border-sky-500 bg-sky-50 text-sky-800"
                : "border-zinc-200 text-zinc-600"
            }`}
          >
            {markAsDelivered ? "✓ Entregue" : "Marcar como entregue"}
          </button>

          <button
            type="button"
            disabled={submitting || cart.length === 0}
            onClick={() => void checkout()}
            className="admin-btn-primary min-h-12 w-full text-base disabled:opacity-50"
          >
            {submitting ? "Registrando…" : "Finalizar venda"}
          </button>
        </aside>
      </div>

      {pixPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 w-full max-w-sm space-y-4 rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-950">
            <h2 className="text-lg font-bold">PIX · {pixPending.orderCode}</h2>
            <p className="text-2xl font-black">
              {formatPrice(pixPending.totalCents)}
            </p>
            {pixKey ? (
              <PixQrCode
                amountCents={pixPending.totalCents}
                pixKey={pixKey}
              />
            ) : (
              <p className="text-sm text-red-600">Chave PIX não configurada.</p>
            )}
            <button
              type="button"
              disabled={confirmingPix}
              onClick={() => void confirmPix()}
              className="admin-btn-primary min-h-12 w-full"
            >
              {confirmingPix ? "Confirmando…" : "Pagamento confirmado"}
            </button>
            <button
              type="button"
              className="w-full text-sm text-zinc-500 hover:underline"
              onClick={() => setPixPending(null)}
            >
              Fechar (fica em contas a receber)
            </button>
          </div>
        </div>
      )}

      {stockProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer bg-black/40"
            aria-label="Fechar"
            onClick={() => setStockProduct(null)}
          />
          <div className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl dark:bg-zinc-950 sm:rounded-3xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold text-emerald-700">
                  {stockProduct.codeLabel}
                </p>
                <h2 className="text-lg font-bold">{stockProduct.name}</h2>
                <p className="text-sm text-zinc-500">
                  Estoque {stockProduct.available}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStockProduct(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100"
              >
                Fechar
              </button>
            </div>
            <StockForm
              product={stockProduct}
              onBack={() => setStockProduct(null)}
              onAdjusted={refreshAfterStock}
              onError={setError}
            />
          </div>
        </div>
      )}
    </div>
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
      onAdjusted(`Estoque de ${product.name} atualizado: ${data.balance} un.`);
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
              setQuantity(value === "adjust" ? product.available : 1);
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
