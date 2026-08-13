"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import {
  buildPaidOrderWhatsAppMessage,
  openWhatsAppChat,
} from "@/lib/cart-checkout";
import { CheckIcon } from "@/components/icons/UiIcons";

export type CartPixOrder = {
  orderId: string;
  /** Código sequencial (PD0001) — usado na mensagem do WhatsApp */
  orderCode: string;
  accessToken?: string;
  totalCents: number;
  pixCopyPaste?: string;
  pixQrCode?: string;
};

type CartPixPaymentProps = {
  order: CartPixOrder;
  whatsapp: string | null;
  messageLines: string[];
  /** Opcional — ex.: analytics. Não deve limpar a tela de sucesso. */
  onWhatsAppContinue?: () => void;
};

export function CartPixPayment({
  order,
  whatsapp,
  messageLines,
  onWhatsAppContinue,
}: CartPixPaymentProps) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("PENDING");
  const [orderCode, setOrderCode] = useState(order.orderCode);

  const poll = useCallback(async () => {
    const qs = order.accessToken
      ? `?token=${encodeURIComponent(order.accessToken)}`
      : "";
    const res = await fetch(`/api/orders/${order.orderId}${qs}`);
    if (!res.ok) return;
    const data = await res.json();
    const next = data.status ?? data.payment?.status ?? "PENDING";
    setStatus(next);
    if (typeof data.code === "string" && data.code) {
      setOrderCode(data.code);
    }
  }, [order.orderId, order.accessToken]);

  useEffect(() => {
    poll();
    const id = window.setInterval(poll, 3000);
    return () => window.clearInterval(id);
  }, [poll]);

  async function copyPix() {
    if (!order.pixCopyPaste) return;
    await navigator.clipboard.writeText(order.pixCopyPaste);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const paid = status === "PAID" || status === "APPROVED";
  const phone = whatsapp?.replace(/\D/g, "") ?? "";

  function openWhatsApp() {
    if (!phone) return;
    const message = buildPaidOrderWhatsAppMessage({
      orderCode,
      lines: messageLines,
      totalCents: order.totalCents,
      paymentMethod: "pix",
    });
    onWhatsAppContinue?.();
    openWhatsAppChat(phone, message);
  }

  if (paid) {
    return (
      <div className="space-y-3 rounded-xl border border-brand/15 bg-brand-light/40 px-4 py-5 text-center">
        <CheckIcon className="mx-auto h-10 w-10 text-brand" />
        <p className="text-sm font-semibold text-brand-dark">
          Pagamento confirmado!
        </p>
        <p className="text-sm text-[#3d7a62]">
          Total pago:{" "}
          <span className="font-bold text-brand-dark">
            {formatPrice(order.totalCents)}
          </span>
        </p>
        <p className="text-sm text-[#3d7a62]">
          Próximo passo: combine a entrega ou retirada pelo WhatsApp.
        </p>
        {phone ? (
          <button
            type="button"
            onClick={openWhatsApp}
            className="w-full rounded-2xl bg-[#25D366] py-3 text-sm font-extrabold text-white shadow-[0_10px_26px_rgba(37,211,102,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#20bd5a] active:scale-[0.98]"
          >
            Continuar no WhatsApp
          </button>
        ) : (
          <p className="text-xs text-amber-800">
            WhatsApp da loja não configurado.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand/15 bg-white/80 px-4 py-4">
      <p className="text-sm font-semibold text-brand-dark">
        PIX gerado — pague para confirmar
      </p>
      <p className="text-sm text-[#3d7a62]">
        Total:{" "}
        <span className="font-bold text-brand-dark">
          {formatPrice(order.totalCents)}
        </span>
      </p>

      {order.pixQrCode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${order.pixQrCode}`}
          alt="QR Code PIX"
          width={200}
          height={200}
          className="mx-auto rounded-xl border border-brand/15 bg-white p-2"
        />
      )}

      {order.pixCopyPaste && (
        <>
          <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-[11px] break-all whitespace-pre-wrap">
            {order.pixCopyPaste}
          </pre>
          <button
            type="button"
            onClick={copyPix}
            className="w-full rounded-xl border border-brand/20 bg-white px-3 py-2 text-xs font-semibold text-brand-dark hover:bg-brand-light/30"
          >
            {copied ? "Código copiado!" : "Copiar PIX copia e cola"}
          </button>
        </>
      )}

      <p className="text-center text-xs text-[#6B7280]">
        Status: Aguardando pagamento
      </p>
      <p className="text-center text-xs text-[#6B7280]">
        Após pagar, esta tela libera o WhatsApp automaticamente.
      </p>

      {process.env.NODE_ENV !== "production" && (
        <button
          type="button"
          onClick={async () => {
            await fetch(`/api/orders/${order.orderId}/simulate-pay`, {
              method: "POST",
            });
            poll();
          }}
          className="w-full rounded-xl bg-amber-500 py-2 text-xs font-medium text-white"
        >
          [DEV] Simular pagamento PIX
        </button>
      )}
    </div>
  );
}
