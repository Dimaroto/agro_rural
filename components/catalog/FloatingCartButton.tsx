"use client";

import { useFiltersSticky } from "@/hooks/useFiltersSticky";

type FloatingCartButtonProps = {
  itemCount: number;
  onOpen: () => void;
};

function CartButtonContent({ itemCount }: { itemCount: number }) {
  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[18px] w-[18px]"
        aria-hidden
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span className="hidden sm:inline">Carrinho</span>
      {itemCount > 0 && (
        <span className="catalog-cart-btn__badge">{itemCount}</span>
      )}
    </>
  );
}

export function FloatingCartButton({
  itemCount,
  onOpen,
}: FloatingCartButtonProps) {
  const dockedBottom = useFiltersSticky();
  const label =
    itemCount > 0
      ? `Abrir carrinho com ${itemCount} itens`
      : "Abrir carrinho";

  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        aria-hidden={dockedBottom}
        tabIndex={dockedBottom ? -1 : 0}
        className={`catalog-cart-btn catalog-cart-btn--floating-top fixed z-40 touch-manipulation transition-all duration-300 ease-out motion-reduce:transition-none ${
          dockedBottom
            ? "pointer-events-none scale-95 opacity-0"
            : "scale-100 opacity-100"
        }`}
      >
        <CartButtonContent itemCount={itemCount} />
      </button>

      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        aria-hidden={!dockedBottom}
        tabIndex={dockedBottom ? 0 : -1}
        className={`catalog-cart-btn catalog-cart-btn--floating-bottom-right fixed z-40 touch-manipulation transition-all duration-300 ease-out motion-reduce:transition-none ${
          dockedBottom
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-2 scale-95 opacity-0"
        }`}
      >
        <CartButtonContent itemCount={itemCount} />
      </button>
    </>
  );
}
