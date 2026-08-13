"use client";

import type { CatalogProduct } from "@/components/ProductCard";
import { formatPrice } from "@/lib/format";
import { isPhotoImageUrl } from "@/lib/image-url";
import Image from "next/image";
import { ProductPlaceholder } from "@/components/icons/UiIcons";

function getThumb(imageUrl: string | null) {
  if (!imageUrl) return null;
  return imageUrl;
}

type CatalogFeaturedSectionProps = {
  products: CatalogProduct[];
  onSelect: (product: CatalogProduct) => void;
};

export function CatalogFeaturedSection({
  products,
  onSelect,
}: CatalogFeaturedSectionProps) {
  if (products.length === 0) return null;

  return (
    <section
      aria-label="Destaques da loja"
      className="relative overflow-hidden rounded-3xl border border-emerald-900/10 bg-gradient-to-br from-[#dcefd1]/82 via-[#eef7e8]/68 to-[#bfd9ad]/58 p-4 shadow-[0_8px_24px_rgba(20,83,45,0.07),0_24px_60px_rgba(14,159,110,0.08)] backdrop-blur-sm sm:p-5"
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand/10 blur-2xl"
        aria-hidden
      />
      <div className="relative mb-3.5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">
            Destaques
          </p>
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-brand-dark sm:text-2xl">
            Mais pedidos
          </h2>
        </div>
        <span className="rounded-full border border-brand/15 bg-brand-cream/85 px-3 py-1 text-[11px] font-semibold text-brand-dark">
          Escolhas da loja
        </span>
      </div>

      <div className="relative grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {products.map((product) => {
          const thumb = getThumb(product.imageUrl);
          const isPhoto = isPhotoImageUrl(thumb);

          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelect(product)}
              className="group flex flex-col overflow-hidden rounded-2xl border border-emerald-900/10 bg-[#edf7e7]/82 text-left shadow-[0_6px_18px_rgba(20,83,45,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-brand/25 hover:bg-[#f3faee]/88 hover:shadow-[0_14px_30px_rgba(14,159,110,0.12)] touch-manipulation"
            >
              <div className="relative aspect-square overflow-hidden bg-brand-light/50">
                {isPhoto && thumb ? (
                  <Image
                    src={thumb}
                    alt={product.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 25vw"
                    unoptimized
                  />
                ) : thumb ? (
                  <div className="flex h-full items-center justify-center p-4">
                    <Image
                      src={thumb}
                      alt=""
                      width={56}
                      height={56}
                      className="opacity-60"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center opacity-40 text-brand-dark/50">
                    <ProductPlaceholder className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-3 text-[0.8125rem] font-bold leading-snug text-brand-dark group-hover:text-brand lg:line-clamp-2">
                  {product.name}
                </p>
                <p className="mt-auto text-base font-extrabold text-brand-dark">
                  {formatPrice(product.priceCents)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
