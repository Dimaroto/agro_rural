"use client";

import { formatPrice } from "@/lib/format";
import {
  buildPaidOrderWhatsAppMessage,
  openWhatsAppChat,
} from "@/lib/cart-checkout";
import { CheckIcon } from "@/components/icons/UiIcons";

type CartPaidSuccessProps = {
  orderCode: string;
  totalCents: number;
  paymentMethod: "pix" | "card";
  whatsapp: string | null;
  messageLines: string[];
  onWhatsAppContinue?: () => void;
};

/** Tela de sucesso pós-pagamento (PIX ou cartão) no carrinho. */
export function CartPaidSuccess({
  orderCode,
  totalCents,
  paymentMethod,
  whatsapp,
  messageLines,
  onWhatsAppContinue,
}: CartPaidSuccessProps) {
  const phone = whatsapp?.replace(/\D/g, "") ?? "";

  function openWhatsApp() {
    if (!phone) return;
    const message = buildPaidOrderWhatsAppMessage({
      orderCode,
      lines: messageLines,
      totalCents,
      paymentMethod,
    });
    onWhatsAppContinue?.();
    openWhatsAppChat(phone, message);
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand/15 bg-brand-light/40 px-4 py-5 text-center">
      <CheckIcon className="mx-auto h-10 w-10 text-brand" />
      <p className="text-sm font-semibold text-brand-dark">
        Pagamento confirmado!
      </p>
      <p className="text-sm text-[#3d7a62]">
        Total pago:{" "}
        <span className="font-bold text-brand-dark">
          {formatPrice(totalCents)}
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
