"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type UIEvent,
} from "react";
import type { CatalogProduct } from "@/components/ProductCard";
import { formatPrice } from "@/lib/format";
import { hasDisplayImage, isPhotoImageUrl } from "@/lib/image-url";
import { HOME_BANNER_ASPECT_CLASS } from "@/lib/home-banner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CategorySlugIcon,
  ProductPlaceholder,
} from "@/components/icons/UiIcons";
import { useProductDetail } from "@/lib/product-detail-context";

type Category = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  showOnHome?: boolean;
};

function useCategoryItemsPerView() {
  const [itemsPerView, setItemsPerView] = useState(1);

  useEffect(() => {
    const update = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) setItemsPerView(3);
      else if (window.matchMedia("(min-width: 640px)").matches) setItemsPerView(2);
      else setItemsPerView(1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return itemsPerView;
}

function CategoriesCarousel({
  categories,
  countByCategory,
}: {
  categories: Category[];
  countByCategory: Record<string, number>;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemsPerView = useCategoryItemsPerView();
  const [activeIndex, setActiveIndex] = useState(0);
  const maxIndex = Math.max(0, categories.length - itemsPerView);
  const stepCount = maxIndex + 1;

  const getStepWidth = useCallback((el: HTMLDivElement) => {
    const first = el.firstElementChild as HTMLElement | null;
    if (!first) return Math.max(el.clientWidth, 1);
    const styles = getComputedStyle(el);
    const gap = parseFloat(styles.columnGap || styles.gap || "20") || 20;
    return first.offsetWidth + gap;
  }, []);

  const syncActiveIndex = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = getStepWidth(el);
    const index = Math.round(el.scrollLeft / Math.max(step, 1));
    setActiveIndex(Math.min(maxIndex, Math.max(0, index)));
  }, [getStepWidth, maxIndex]);

  useEffect(() => {
    syncActiveIndex();
  }, [itemsPerView, categories.length, syncActiveIndex]);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const step = getStepWidth(el);
    const index = Math.round(el.scrollLeft / Math.max(step, 1));
    setActiveIndex(Math.min(maxIndex, Math.max(0, index)));
  };

  const goToIndex = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.min(maxIndex, Math.max(0, index));
    const step = getStepWidth(el);
    el.scrollTo({ left: next * step, behavior: "smooth" });
    setActiveIndex(next);
  };

  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < maxIndex;
  const showControls = maxIndex > 0;

  return (
    <div>
      <div className="flex items-center gap-2 sm:gap-3">
        {showControls && (
          <button
            type="button"
            aria-label="Categoria anterior"
            disabled={!canGoPrev}
            onClick={() => goToIndex(activeIndex - 1)}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-brand/25 bg-brand-cream text-brand-dark shadow-[0_4px_12px_rgba(15,35,28,0.08)] transition-colors hover:border-brand/40 hover:bg-white disabled:cursor-default disabled:opacity-35 sm:h-10 sm:w-10"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>
        )}

        <div
          ref={scrollerRef}
          onScroll={onScroll}
          className="flex min-w-0 flex-1 cursor-grab gap-5 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth snap-x snap-mandatory py-2 active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Carrossel de categorias"
        >
          {categories.map((category) => (
            <div
              key={category.id}
              className="w-full min-w-0 shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-2.5rem)/3)]"
            >
              <CategoryCard
                category={category}
                productCount={countByCategory[category.id] ?? 0}
              />
            </div>
          ))}
        </div>

        {showControls && (
          <button
            type="button"
            aria-label="Próxima categoria"
            disabled={!canGoNext}
            onClick={() => goToIndex(activeIndex + 1)}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-brand/25 bg-brand-cream text-brand-dark shadow-[0_4px_12px_rgba(15,35,28,0.08)] transition-colors hover:border-brand/40 hover:bg-white disabled:cursor-default disabled:opacity-35 sm:h-10 sm:w-10"
          >
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {showControls && (
        <div
          className="mt-5 flex items-center justify-center gap-2"
          role="tablist"
          aria-label="Posição do carrossel de categorias"
        >
          {Array.from({ length: stepCount }, (_, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Ir para posição ${index + 1}`}
                onClick={() => goToIndex(index)}
                className={`h-2.5 rounded-full transition-all ${
                  isActive
                    ? "w-6 bg-brand-dark"
                    : "w-2.5 bg-brand-dark/25 hover:bg-brand-dark/45"
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function LatestProductCard({ product }: { product: CatalogProduct }) {
  const { openProduct } = useProductDetail();
  const isPhoto = isPhotoImageUrl(product.imageUrl);

  return (
    <button
      type="button"
      onClick={() => openProduct(product)}
      className="catalog-card-grow group flex flex-col overflow-hidden rounded-2xl border border-brand/20 bg-brand-cream text-left shadow-[0_8px_24px_rgba(15,35,28,0.1)] hover:border-brand/35 hover:shadow-[0_14px_32px_rgba(15,35,28,0.14)]"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-brand-light">
        {isPhoto && product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center opacity-50 text-brand-dark/40">
            <ProductPlaceholder className="h-10 w-10" />
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-brand-dark">
          {product.name}
        </h3>
        <p className="mt-auto text-base font-extrabold tabular-nums text-brand-dark">
          {formatPrice(product.priceCents)}
        </p>
      </div>
    </button>
  );
}

function CategoryCard({
  category,
  productCount,
}: {
  category: Category;
  productCount: number;
}) {
  const hasImage = hasDisplayImage(category.imageUrl);

  return (
    <Link
      href={`/produtos/${category.slug}`}
      className="catalog-card-grow group flex h-full flex-col overflow-hidden rounded-3xl border border-brand/20 bg-brand-cream shadow-[0_10px_28px_rgba(15,35,28,0.12)] hover:border-brand/35 hover:shadow-[0_16px_36px_rgba(15,35,28,0.16)]"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-light">
        {hasImage && category.imageUrl ? (
          <Image
            src={category.imageUrl}
            alt={category.name}
            fill
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            sizes="(max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-brand/15 text-brand-dark/70">
            <CategorySlugIcon slug={category.slug} className="h-12 w-12" />
          </span>
        )}
        <div className="absolute inset-0 bg-brand-dark/10 transition-colors group-hover:bg-brand-dark/5" />
      </div>
      <div className="flex flex-col gap-1 p-5 sm:p-6">
        <h3 className="text-lg font-extrabold text-brand-dark sm:text-xl">
          {category.name}
        </h3>
        <p className="text-sm font-medium text-brand-dark/65">
          {productCount} {productCount === 1 ? "produto" : "produtos"}
        </p>
      </div>
    </Link>
  );
}

export function HomeLanding({
  storeName,
  bannerUrl,
  categories,
  products,
}: {
  storeName: string;
  bannerUrl?: string | null;
  categories: Category[];
  products: CatalogProduct[];
}) {
  const latest = [...products]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, 8);

  const countByCategory = products.reduce<Record<string, number>>(
    (acc, p) => {
      const ids =
        p.categoryIds && p.categoryIds.length > 0
          ? p.categoryIds
          : [p.categoryId];
      for (const id of ids) {
        acc[id] = (acc[id] ?? 0) + 1;
      }
      return acc;
    },
    {}
  );

  // Casinha marcada = aparece na home (já filtradas por active no catálogo).
  const visibleCategories = categories.filter((c) => c.showOnHome ?? true);

  return (
    <div className="catalog-page catalog-page--simple">
      <div className="mx-auto w-full max-w-[var(--catalog-content-max)] px-[var(--catalog-gutter)] py-8 sm:py-10 lg:py-12">
        {bannerUrl && hasDisplayImage(bannerUrl) ? (
          <section className="home-hero overflow-hidden rounded-3xl border border-brand/25 p-0">
            <Link
              href="/produtos"
              aria-label="Ver produtos"
              className={`relative block w-full overflow-hidden ${HOME_BANNER_ASPECT_CLASS}`}
            >
              <Image
                src={bannerUrl}
                alt={storeName}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1280px) 100vw, 80rem"
                unoptimized
              />
            </Link>
          </section>
        ) : (
          <section className="home-hero rounded-3xl border border-brand/25 px-6 py-10 text-center sm:px-10 sm:py-14">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              Saboaria artesanal
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-brand-dark sm:text-4xl">
              {storeName}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-brand-dark/75 sm:text-base">
              Sabonetes, sachês perfumados e sprays feitos à mão com ingredientes
              selecionados. Explore nossos produtos e leve o aroma da natureza para
              a sua casa.
            </p>
            <div className="mt-7 flex justify-center">
              <Link
                href="/produtos"
                className="rounded-full bg-brand-dark px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-brand"
              >
                Ver produtos
              </Link>
            </div>
          </section>
        )}

        {latest.length > 0 && (
          <section className="mt-10 sm:mt-12">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 className="text-xl font-extrabold text-brand-dark sm:text-2xl">
                Últimos lançamentos
              </h2>
              <Link href="/produtos" className="home-cta">
                Ver todos
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
              {latest.map((product) => (
                <LatestProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}

        {visibleCategories.length > 0 && (
          <section className="mt-10 sm:mt-12">
            <h2 className="mb-5 text-xl font-extrabold text-brand-dark sm:text-2xl">
              Categorias
            </h2>
            <CategoriesCarousel
              categories={visibleCategories}
              countByCategory={countByCategory}
            />
          </section>
        )}

        <div className="mt-10 flex justify-center sm:mt-12">
          <Link href="/produtos" className="home-cta home-cta--large">
            Ver todos os produtos
          </Link>
        </div>
      </div>
    </div>
  );
}
