"use client";

import Image from "next/image";
import { formatPrice } from "@/lib/format";
import type { StockStatus } from "@/lib/format";
import { splitProductDescription } from "@/lib/productDisplay";
import { isPhotoImageUrl } from "@/lib/image-url";
import { StockBadge } from "./StockBadge";
import { ProductPlaceholder } from "@/components/icons/UiIcons";
import type { ProductFieldView } from "@/lib/party-favor-fields";

export type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  extraImageUrls?: string[];
  categoryId: string;
  categoryIds?: string[];
  categoryName: string;
  categorySlug: string;
  categories?: Array<{ id: string; name: string; slug: string }>;
  stockStatus: StockStatus;
  available: number;
  createdAt?: string;
  customizationFields?: ProductFieldView[];
  measures?: string[];
};

type ImageKind = "photo" | "icon" | "none";

function getImageKind(imageUrl: string | null): ImageKind {
  if (!imageUrl) return "none";
  if (isPhotoImageUrl(imageUrl)) return "photo";
  return "icon";
}

function ProductImagePlaceholder({ kind }: { kind: "icon" | "none" }) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-brand-light sm:rounded-2xl">
      <div className="absolute inset-0 animate-shimmer bg-brand-cream/40 motion-reduce:animate-none" />
      {kind === "none" ? (
        <span className="relative text-brand/35">
          <ProductPlaceholder className="h-10 w-10" />
        </span>
      ) : (
        <div className="relative h-10 w-10 rounded-full border-2 border-brand/20 border-t-brand animate-spin motion-reduce:animate-none" />
      )}
    </div>
  );
}

export function ProductCard({
  product,
  onAdd,
  onOpen,
  inCartQty = 0,
}: {
  product: CatalogProduct;
  onAdd?: (product: CatalogProduct) => void;
  onOpen?: (product: CatalogProduct) => void;
  inCartQty?: number;
}) {
  const outOfStock =
    product.stockStatus === "out_of_stock" || product.available <= 0;
  const imageKind = getImageKind(product.imageUrl);
  const { subtitle, sizeLabel } = splitProductDescription(product.description);

  function handleAdd() {
    if (outOfStock) return;
    if (!onAdd) return;
    // Abre o popup para o cliente conferir detalhes/campos antes do carrinho.
    if (onOpen) {
      onOpen(product);
      return;
    }
    onAdd(product);
  }

  function handleOpen() {
    onOpen?.(product);
  }

  return (
    <article className="catalog-product-card catalog-card-grow group relative flex flex-col overflow-hidden rounded-2xl border border-brand/20 bg-brand-cream shadow-[0_8px_24px_rgba(26, 46, 18,0.1)] hover:border-brand/35 hover:shadow-[0_14px_32px_rgba(26, 46, 18,0.14)] sm:rounded-3xl sm:shadow-[0_8px_24px_rgba(26, 46, 18,0.12)] sm:hover:shadow-[0_14px_32px_rgba(26, 46, 18,0.16)]">
      <div
        className="pointer-events-none absolute inset-0 z-10 hidden rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:block bg-brand-light/30"
        aria-hidden
      />

      <button
        type="button"
        onClick={handleOpen}
        className="flex flex-1 flex-col text-left touch-manipulation"
        aria-label={`Ver detalhes de ${product.name}`}
      >
        {/* Uma única imagem — evita download duplo mobile+desktop */}
        <div className="relative aspect-square w-full overflow-hidden bg-brand-light sm:p-3 sm:pb-0">
          <div className="relative h-full w-full overflow-hidden sm:rounded-2xl sm:bg-brand-light/50 sm:shadow-[inset_0_1px_8px_rgba(20,83,45,0.08)]">
            {imageKind === "photo" && product.imageUrl ? (
              <>
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] sm:group-hover:scale-[1.06]"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  draggable={false}
                />
                <div className="pointer-events-none absolute inset-0 hidden bg-brand-dark/10 sm:block" />
              </>
            ) : imageKind === "icon" && product.imageUrl ? (
              <div className="flex h-full w-full items-center justify-center bg-brand-light">
                <Image
                  src={product.imageUrl}
                  alt=""
                  width={80}
                  height={80}
                  className="opacity-55"
                  draggable={false}
                />
              </div>
            ) : (
              <span className="flex h-full w-full items-center justify-center opacity-50 text-brand-dark/40 sm:hidden">
                <ProductPlaceholder className="h-10 w-10" />
              </span>
            )}

            {imageKind === "none" && (
              <div className="hidden h-full sm:block">
                <ProductImagePlaceholder kind="none" />
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 hidden bg-brand-dark/15 opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:block" />

            <div className="absolute left-2 top-2 z-20 hidden sm:block">
              <StockBadge
                status={product.stockStatus}
                available={product.available}
                compact
                overlay
              />
            </div>

            {inCartQty > 0 && (
              <span className="absolute right-2 top-2 z-20 hidden rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold text-white shadow-[0_4px_12px_rgba(14,159,110,0.35)] sm:inline-block">
                {inCartQty} no carrinho
              </span>
            )}
          </div>
        </div>

        {/* Mobile: só nome + preço (igual Últimos lançamentos) */}
        <div className="flex flex-1 flex-col gap-1 p-3 sm:hidden">
          <h3 className="line-clamp-2 text-sm font-bold leading-snug text-brand-dark">
            {product.name}
          </h3>
          <p className="mt-auto text-base font-extrabold tabular-nums text-brand-dark">
            {formatPrice(product.priceCents)}
          </p>
        </div>

        {/* Desktop/tablet: detalhes completos */}
        <div className="relative hidden flex-col gap-1.5 p-3.5 pt-3 sm:flex sm:p-4 sm:pt-3.5">
          <h3 className="line-clamp-3 text-base font-bold leading-snug tracking-[-0.01em] text-brand-dark transition-colors duration-200 group-hover:text-brand lg:line-clamp-2 lg:text-lg">
            {product.name}
          </h3>

          {subtitle && (
            <p className="line-clamp-2 text-sm leading-relaxed text-[#3d7a62] lg:text-base">
              {subtitle}
            </p>
          )}

          {sizeLabel && (
            <p className="text-xs font-semibold uppercase tracking-wide text-[#3d7a62]/80 lg:text-sm">
              {sizeLabel}
            </p>
          )}

          <div className="mt-auto flex items-end justify-between gap-2 border-t border-brand-light/80 pt-3">
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-brand/80 lg:inline">
              Valor
            </span>
            <p className="text-lg font-extrabold tabular-nums tracking-tight text-brand-dark sm:text-xl">
              {formatPrice(product.priceCents)}
            </p>
          </div>
        </div>
      </button>

      {onAdd && (
        <div className="hidden px-3.5 pb-3.5 sm:block sm:px-4 sm:pb-4">
          <button
            type="button"
            onClick={handleAdd}
            className={`w-full min-h-[3rem] rounded-2xl py-3.5 text-base font-bold text-white shadow-[0_8px_22px_rgba(26, 46, 18,0.22)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-brand active:translate-y-0 active:scale-[0.98] touch-manipulation select-none ${
              outOfStock
                ? "cursor-not-allowed bg-zinc-400 shadow-none hover:translate-y-0 hover:bg-zinc-400"
                : "bg-brand-dark"
            }`}
            disabled={outOfStock}
          >
            {outOfStock
              ? "Esgotado"
              : inCartQty > 0
                ? `Adicionar ao carrinho (${inCartQty})`
                : "Adicionar ao carrinho"}
          </button>
        </div>
      )}
    </article>
  );
}
