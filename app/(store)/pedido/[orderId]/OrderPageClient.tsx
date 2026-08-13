"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { CheckIcon } from "@/components/icons/UiIcons";
import { buildPaidOrderWhatsAppMessage, openWhatsAppChat } from "@/lib/cart-checkout";
import { saveCart } from "@/lib/cartStorage";

type OrderData = {
  orderId: string;
  accessToken?: string;
  paymentMethod?: "pix" | "card";
  totalCents: number;
  pixCopyPaste?: string;
  pixQrCode?: string;
  checkoutUrl?: string;
  expiresAt: string;
};

type OrderStatus = {
  status: string;
  code?: string;
  totalCents: number;
  storeSlug?: string;
  storeWhatsapp?: string | null;
  items?: Array<{
    productName: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  payment?: {
    status: string;
    method?: string | null;
    checkoutUrl?: string | null;
    pixCopyPaste?: string | null;
    paidAt?: string;
  };
};

function resolveAccessToken(
  orderId: string,
  searchParams: URLSearchParams,
  stored?: OrderData | null
): string | null {
  const fromUrl = searchParams.get("token")?.trim();
  if (fromUrl) return fromUrl;
  if (stored?.accessToken) return stored.accessToken;
  try {
    const raw = sessionStorage.getItem(`order-${orderId}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as { accessToken?: string };
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

export default function OrderPageClient() {
  const { orderId } = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [copied, setCopied] = useState(false);

  const loadOrder = useCallback(async () => {
    const raw = sessionStorage.getItem(`order-${orderId}`);
    let stored: OrderData | null = null;
    if (raw) {
      stored = JSON.parse(raw) as OrderData;
      setOrder(stored);
    }

    const token = resolveAccessToken(orderId, searchParams, stored);
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/orders/${orderId}${qs}`);
    if (!res.ok) {
      if (!stored) return;
      return;
    }
    const data = await res.json();
    const next: OrderData = {
      orderId: data.id,
      accessToken: token ?? undefined,
      paymentMethod: data.payment?.method === "card" ? "card" : "pix",
      totalCents: data.totalCents,
      pixCopyPaste: data.payment?.pixCopyPaste ?? stored?.pixCopyPaste ?? "",
      checkoutUrl:
        data.payment?.checkoutUrl ?? stored?.checkoutUrl ?? undefined,
      expiresAt: stored?.expiresAt ?? new Date().toISOString(),
    };
    setOrder(next);
    if (token) {
      sessionStorage.setItem(`order-${orderId}`, JSON.stringify(next));
    }
  }, [orderId, searchParams]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const pollStatus = useCallback(async () => {
    const token = resolveAccessToken(orderId, searchParams, order);
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const res = await fetch(`/api/orders/${orderId}${qs}`);
    if (res.ok) {
      const data = await res.json();
      setStatus(data);
    }
  }, [orderId, searchParams, order]);

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [pollStatus]);

  const paid = status?.status === "PAID";

  async function simulatePay() {
    await fetch(`/api/orders/${orderId}/simulate-pay`, { method: "POST" });
    pollStatus();
  }

  function copyPix() {
    if (!order?.pixCopyPaste) return;
    navigator.clipboard.writeText(order.pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openWhatsAppAfterPayment() {
    const phone = status?.storeWhatsapp?.replace(/\D/g, "") ?? "";
    if (!phone || !status?.items?.length) return;

    const paymentMethod =
      order?.paymentMethod === "card" || status.payment?.method === "card"
        ? "card"
        : "pix";

    const message = buildPaidOrderWhatsAppMessage({
      orderCode: status.code ?? `#${orderId.slice(-8)}`,
      lines: status.items.map(
        (item) =>
          `• ${item.quantity}x ${item.productName} — ${formatPrice(item.unitPriceCents * item.quantity)}`
      ),
      totalCents: status.totalCents,
      paymentMethod,
    });

    if (status.storeSlug) {
      try {
        saveCart(status.storeSlug, []);
      } catch {
        /* ignore */
      }
    }

    openWhatsAppChat(phone, message);
  }

  const isCard =
    order?.paymentMethod === "card" ||
    status?.payment?.method === "card" ||
    Boolean(order?.checkoutUrl || status?.payment?.checkoutUrl);
  const checkoutUrl = order?.checkoutUrl ?? status?.payment?.checkoutUrl ?? "";
  const returnStatus = searchParams.get("status");
  const canWhatsApp =
    paid && Boolean(status?.storeWhatsapp?.replace(/\D/g, ""));

  return (
    <div className="catalog-page-content mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="mb-2 text-2xl font-bold text-brand-dark">
        {paid
          ? "Pagamento confirmado!"
          : isCard
            ? "Aguardando pagamento com cartão"
            : "Aguardando PIX"}
      </h1>
      {order && (
        <p className="mb-6 text-lg text-brand">
          Total: {formatPrice(order.totalCents)}
        </p>
      )}

      {paid ? (
        <div className="space-y-4 rounded-2xl bg-brand-light/40 p-6 text-center">
          <CheckIcon className="mx-auto h-10 w-10 text-brand" />
          <p className="mt-2 font-medium text-brand-dark">
            Seu pedido foi confirmado e o estoque foi atualizado.
          </p>
          <p className="text-sm text-zinc-600">
            Próximo passo: combine a entrega ou retirada pelo WhatsApp.
          </p>
          {canWhatsApp && (
            <button
              type="button"
              onClick={openWhatsAppAfterPayment}
              className="w-full rounded-2xl bg-[#25D366] py-3 text-sm font-extrabold text-white shadow-[0_10px_26px_rgba(37,211,102,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#20bd5a] active:scale-[0.98]"
            >
              Continuar no WhatsApp
            </button>
          )}
        </div>
      ) : isCard ? (
        <div className="space-y-4 rounded-2xl border border-brand/10 bg-white p-5 shadow-sm">
          {returnStatus === "success" && (
            <p className="rounded-xl bg-brand-light/40 px-3 py-2 text-sm text-brand-dark">
              Pagamento enviado. Aguarde a confirmação automática do pedido.
            </p>
          )}
          {returnStatus === "canceled" && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Pagamento cancelado. Você pode tentar novamente.
            </p>
          )}
          {returnStatus === "expired" && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
              O link de pagamento expirou. Faça um novo pedido.
            </p>
          )}
          <p className="text-sm leading-relaxed text-zinc-600">
            Conclua o pagamento na página segura do Mercado Pago com cartão de
            crédito ou débito.
          </p>
          {checkoutUrl ? (
            <a
              href={checkoutUrl}
              className="block w-full rounded-xl bg-brand-dark py-3 text-center font-semibold text-white hover:bg-brand"
            >
              Ir para pagamento
            </a>
          ) : null}
          <p className="text-center text-sm text-zinc-500">
            Status: {status?.payment?.status ?? status?.status ?? "..."}
          </p>
          {process.env.NODE_ENV !== "production" && (
            <button
              type="button"
              onClick={simulatePay}
              className="w-full rounded-xl bg-amber-500 py-2 text-sm font-medium text-white"
            >
              [DEV] Simular pagamento
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-brand/10 bg-white p-5 shadow-sm">
          {order?.pixQrCode && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${order.pixQrCode}`}
              alt="QR Code PIX"
              className="mx-auto h-48 w-48"
            />
          )}
          {order?.pixCopyPaste && (
            <>
              <p className="text-sm text-zinc-600">PIX copia e cola:</p>
              <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs break-all whitespace-pre-wrap">
                {order.pixCopyPaste}
              </pre>
              <button
                type="button"
                onClick={copyPix}
                className="w-full rounded-xl border border-brand py-2 font-medium text-brand"
              >
                {copied ? "Copiado!" : "Copiar código PIX"}
              </button>
            </>
          )}
          <p className="text-center text-sm text-zinc-500">
            Status: {status?.payment?.status ?? status?.status ?? "..."}
          </p>
          {process.env.NODE_ENV !== "production" && (
            <button
              type="button"
              onClick={simulatePay}
              className="w-full rounded-xl bg-amber-500 py-2 text-sm font-medium text-white"
            >
              [DEV] Simular pagamento PIX
            </button>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 text-center text-sm">
        <Link href="/meus-pedidos" className="text-brand font-medium">
          Ver meus pedidos
        </Link>
        <Link href="/" className="text-zinc-500">
          Voltar ao catálogo
        </Link>
      </div>
    </div>
  );
}
