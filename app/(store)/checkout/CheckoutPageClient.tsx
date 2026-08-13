"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useCustomerAuth } from "@/lib/customer-auth/provider";
import {
  clearCheckoutSession,
  loadCheckoutSession,
  saveCheckoutSession,
  type CheckoutSession,
} from "@/lib/cartStorage";
import { formatApiError } from "@/lib/apiError";

type CheckoutPageClientProps = {
  storeSlug: string;
  paymentsEnabled: boolean;
  cardPaymentsEnabled: boolean;
};

export default function CheckoutPageClient({
  storeSlug,
  paymentsEnabled,
  cardPaymentsEnabled,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { customer } = useCustomerAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">("pix");
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [ready, setReady] = useState(false);

  const cardEnabled = paymentsEnabled && cardPaymentsEnabled;

  useEffect(() => {
    const loaded = loadCheckoutSession(storeSlug);
    if (!loaded) {
      router.replace("/carrinho");
      return;
    }

    const methodParam = searchParams.get("method");
    let method: "pix" | "card" = "pix";
    if (methodParam === "card" && cardEnabled) {
      method = "card";
    } else if (loaded.paymentMethod === "card" && cardEnabled) {
      method = "card";
    }

    const nextSession: CheckoutSession = {
      ...loaded,
      paymentMethod: method,
    };
    saveCheckoutSession(storeSlug, nextSession);
    setSession(nextSession);
    setPaymentMethod(method);
    setReady(true);
  }, [router, storeSlug, searchParams, cardEnabled]);

  useEffect(() => {
    if (customer) {
      setCustomerName(customer.name ?? "");
      setCustomerPhone(customer.phone ?? "");
    }
  }, [customer]);

  async function handlePay() {
    if (!paymentsEnabled) {
      setError("Pagamentos online não estão habilitados.");
      return;
    }

    setLoading(true);
    setError("");

    const current =
      session ?? loadCheckoutSession(storeSlug);
    if (!current?.items?.length) {
      setError("Carrinho expirado. Volte ao carrinho e tente novamente.");
      setLoading(false);
      return;
    }

    const method = paymentMethod === "card" && cardEnabled ? "card" : "pix";

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeSlug,
        items: current.items,
        paymentMethod: method,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(formatApiError(data.error, "Erro ao criar pedido"));
      return;
    }

    sessionStorage.setItem(`order-${data.orderId}`, JSON.stringify(data));
    clearCheckoutSession(storeSlug);

    if (data.paymentMethod === "card" && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }

    const tokenQs = data.accessToken
      ? `?token=${encodeURIComponent(data.accessToken)}`
      : "";
    router.push(`/pedido/${data.orderId}${tokenQs}`);
  }

  if (!ready) {
    return (
      <div className="catalog-page-content mx-auto w-full max-w-lg flex-1 px-4 py-8 text-center text-zinc-600">
        Carregando checkout…
      </div>
    );
  }

  return (
    <div className="catalog-page-content mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-2 text-2xl font-bold text-brand-dark">Finalizar pedido</h1>
      <p className="mb-6 text-sm text-zinc-600">
        {customer
          ? "Seus dados foram preenchidos automaticamente."
          : "Você pode finalizar sem cadastro ou "}
        {!customer && (
          <Link
            href={`/conta/login?callbackUrl=${encodeURIComponent("/checkout")}`}
            className="font-medium text-brand underline"
          >
            entrar na sua conta
          </Link>
        )}
      </p>

      {cardEnabled && (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-brand/10 bg-white p-1.5">
          <button
            type="button"
            onClick={() => setPaymentMethod("pix")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              paymentMethod === "pix"
                ? "bg-brand text-white"
                : "text-brand-dark hover:bg-brand-light/40"
            }`}
          >
            PIX
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("card")}
            className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              paymentMethod === "card"
                ? "bg-brand text-white"
                : "text-brand-dark hover:bg-brand-light/40"
            }`}
          >
            Cartão
          </button>
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-brand/10 bg-white p-5 shadow-sm">
        {paymentMethod === "card" && (
          <p className="rounded-xl bg-brand-light/35 px-3 py-2.5 text-sm leading-relaxed text-brand-dark">
            Você será redirecionado para a página segura do Mercado Pago para
            pagar com cartão de crédito ou débito.
          </p>
        )}
        {paymentMethod === "pix" && (
          <p className="rounded-xl bg-brand-light/35 px-3 py-2.5 text-sm leading-relaxed text-brand-dark">
            Vamos gerar um QR Code PIX pelo Mercado Pago. Após o pagamento ser
            confirmado, você poderá combinar a entrega pelo WhatsApp.
          </p>
        )}

        <div>
          <label className="text-sm font-medium text-zinc-700">Nome (opcional)</label>
          <input
            className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700">Telefone (opcional)</label>
          <input
            className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
        </div>
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
        <button
          type="button"
          disabled={loading || !paymentsEnabled}
          onClick={handlePay}
          className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading
            ? paymentMethod === "card"
              ? "Gerando pagamento..."
              : "Gerando PIX..."
            : paymentMethod === "card"
              ? "Pagar com cartão"
              : "Gerar cobrança PIX"}
        </button>
        <Link href="/carrinho" className="block text-center text-sm text-zinc-500">
          Voltar ao carrinho
        </Link>
      </div>
    </div>
  );
}
