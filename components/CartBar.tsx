"use client";

import { formatPrice } from "@/lib/format";

export function CartBar({
  itemCount,
  totalCents,
  onOpen,
}: {
  itemCount: number;
  totalCents: number;
  onOpen: () => void;
}) {
  if (itemCount <= 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] border-t-2 border-emerald-600 bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 touch-manipulation active:bg-emerald-50"
        aria-label={`Abrir carrinho com ${itemCount} itens`}
      >
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
          <span className="text-xs font-medium uppercase leading-none">Itens</span>
          <span className="text-xl font-bold leading-tight">{itemCount}</span>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-base font-bold text-zinc-900">Ver carrinho</p>
          <p className="text-sm text-zinc-600">
            Toque para revisar e finalizar o pedido
          </p>
          <p className="mt-0.5 text-lg font-bold text-emerald-700">
            {formatPrice(totalCents)}
          </p>
        </div>
        <span className="shrink-0 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow">
          Abrir
        </span>
      </button>
    </div>
  );
}
