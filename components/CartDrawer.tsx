"use client";

import Image from "next/image";
import { formatPrice } from "@/lib/format";
import type { CatalogProduct } from "./ProductCard";
import type { CartCustomization } from "@/lib/customization";
import { MinusIcon, PackageIcon, PlusIcon } from "@/components/icons/UiIcons";
import {
  formatStockQty,
  lineTotalCents,
  parseStockUnit,
} from "@/lib/stock-unit";

export type CartItem = {
  lineKey: string;
  product: CatalogProduct;
  quantity: number;
  notes?: string;
} & CartCustomization;

export function CartDrawer({
  items,
  open,
  onClose,
  onUpdateQty,
  onCheckout,
  onWhatsApp,
  paymentsEnabled,
}: {
  items: CartItem[];
  open: boolean;
  onClose: () => void;
  onUpdateQty: (lineKey: string, qty: number) => void;
  onCheckout?: () => void;
  onWhatsApp: () => void;
  paymentsEnabled: boolean;
}) {
  const total = items.reduce(
    (s, i) =>
      s +
      lineTotalCents(i.product.priceCents, i.quantity, i.product.stockUnit),
    0
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/50"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        aria-label="Fechar carrinho"
      />
      <div
        className="relative z-10 max-h-[85vh] overflow-auto rounded-t-3xl bg-white p-4 pb-8 shadow-xl touch-manipulation"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">Seu carrinho</h2>
            <p className="text-sm text-zinc-500">
              {items.length} produto{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="relative z-20 min-h-11 min-w-11 rounded-full px-3 py-2 text-zinc-500 hover:bg-zinc-100 touch-manipulation"
          >
            Fechar
          </button>
        </div>

        {items.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">Carrinho vazio</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.lineKey}
                className="flex items-center justify-between gap-2 border-b border-zinc-100 pb-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                    {item.product.imageUrl ? (
                      <Image
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-300">
                        <PackageIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.product.name}</p>
                    <p className="text-sm text-zinc-500">
                      {formatPrice(item.product.priceCents)}
                      {parseStockUnit(item.product.stockUnit) === "KG"
                        ? " / kg"
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {parseStockUnit(item.product.stockUnit) === "KG" ? (
                    <span className="min-w-[4.5rem] text-center text-sm font-semibold">
                      {formatStockQty(item.quantity, "KG")}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border bg-zinc-50 text-lg touch-manipulation"
                        onClick={() =>
                          onUpdateQty(item.lineKey, item.quantity - 1)
                        }
                        aria-label="Remover um"
                      >
                        <MinusIcon className="h-4 w-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-10 w-10 items-center justify-center rounded-lg border bg-zinc-50 text-lg touch-manipulation disabled:opacity-40"
                        onClick={() =>
                          onUpdateQty(item.lineKey, item.quantity + 1)
                        }
                        disabled={item.quantity >= item.product.available}
                        aria-label="Adicionar um"
                      >
                        <PlusIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-4">
            <p className="text-right text-lg font-bold">
              Total: {formatPrice(total)}
            </p>
            <button
              type="button"
              onClick={onWhatsApp}
              className="w-full rounded-xl bg-[#25D366] py-4 text-base font-semibold text-white touch-manipulation"
            >
              Pedir no WhatsApp
            </button>
            {paymentsEnabled && onCheckout && (
              <button
                type="button"
                onClick={onCheckout}
                className="w-full rounded-xl bg-emerald-600 py-4 text-base font-semibold text-white touch-manipulation"
              >
                Pagar com PIX
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
