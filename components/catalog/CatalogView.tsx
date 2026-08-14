"use client";

import { useMemo } from "react";
import { ProductCard, type CatalogProduct } from "@/components/ProductCard";
import { useCatalogSearch } from "@/lib/catalog-search-context";
import { useProductDetail } from "@/lib/product-detail-context";
import { searchIncludes } from "@/lib/search-text";
import { CatalogEmptyState } from "@/components/catalog/CatalogEmptyState";
import {
  CatalogCategorySection,
  CatalogProductsShell,
} from "@/components/catalog/CatalogCategorySection";

type Category = { id: string; name: string; slug: string };

const GRID_CLASS =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5";

export function CatalogView({
  categories,
  products,
  initialCategorySlug,
  categoryTitle,
  title,
  emptyMessage,
}: {
  storeName: string;
  storeSlug: string;
  whatsapp: string | null;
  categories: Category[];
  products: CatalogProduct[];
  paymentsEnabled: boolean;
  cardPaymentsEnabled?: boolean;
  initialCategorySlug?: string;
  categoryTitle?: string;
  title?: string;
  emptyMessage?: string;
}) {
  const { search, setSearch } = useCatalogSearch();
  const { openProduct, qtyByProduct } = useProductDetail();
  const categoryId = useMemo(() => {
    if (!initialCategorySlug) return null;
    const match = categories.find((c) => c.slug === initialCategorySlug);
    return match?.id ?? null;
  }, [initialCategorySlug, categories]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const productCategoryIds =
        (p.categoryIds && p.categoryIds.length > 0
          ? p.categoryIds
          : [p.categoryId]) ?? [p.categoryId];
      const matchCat =
        !categoryId || productCategoryIds.includes(categoryId);
      const matchSearch =
        !search ||
        searchIncludes(p.name, search) ||
        (p.description ? searchIncludes(p.description, search) : false) ||
        searchIncludes(p.categoryName, search) ||
        searchIncludes(p.categorySlug, search) ||
        (p.categories ?? []).some(
          (c) => searchIncludes(c.name, search) || searchIncludes(c.slug, search)
        );
      return matchCat && matchSearch;
    });
  }, [products, categoryId, search]);

  const groupedByCategory = useMemo(() => {
    if (categoryId || search || title) return null;
    const groups: { category: Category; products: CatalogProduct[] }[] = [];
    for (const cat of categories) {
      const catProducts = filtered.filter((p) => {
        const productCategoryIds =
          (p.categoryIds && p.categoryIds.length > 0
            ? p.categoryIds
            : [p.categoryId]) ?? [p.categoryId];
        return productCategoryIds.includes(cat.id);
      });
      if (catProducts.length > 0) {
        groups.push({ category: cat, products: catProducts });
      }
    }
    return groups;
  }, [filtered, categories, categoryId, search, title]);

  function renderProductGrid(items: CatalogProduct[]) {
    return (
      <div className={GRID_CLASS}>
        {items.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            onAdd={openProduct}
            onOpen={openProduct}
            inCartQty={qtyByProduct[p.id] ?? 0}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="catalog-page catalog-page--simple">
      <div className="catalog-main catalog-main--simple relative z-10 flex min-w-0 flex-1 flex-col">
        {(categoryTitle || title) && (
          <div className="catalog-category-heading">
            <div className="catalog-category-heading__inner">
              <h1 className="catalog-category-heading__title">
                {title || categoryTitle}
              </h1>
              <p className="catalog-category-heading__subtitle">
                {title
                  ? title
                  : `Produtos da categoria ${(categoryTitle ?? "").toLowerCase()}`}
              </p>
            </div>
          </div>
        )}

        <main
          id="catalog-products"
          className="catalog-showcase catalog-showcase--simple relative isolate flex-1 scroll-mt-4"
        >
          <div className="catalog-showcase__inner">
            <div className="space-y-4 sm:space-y-5 lg:space-y-6">
              {filtered.length === 0 ? (
                emptyMessage && !search.trim() ? (
                  <div className="rounded-3xl border border-dashed border-brand/25 bg-brand-cream/70 px-6 py-16 text-center">
                    <p className="text-sm text-[#5C6B4A]">{emptyMessage}</p>
                  </div>
                ) : (
                  <CatalogEmptyState
                    categories={categories}
                    hasSearch={Boolean(search.trim())}
                    hasCategoryFilter={Boolean(categoryId)}
                    onClearSearch={() => {
                      setSearch("");
                    }}
                    onClearCategory={() => {
                      window.location.href = "/produtos";
                    }}
                    onSelectCategory={(id) => {
                      const cat = categories.find((c) => c.id === id);
                      if (cat) window.location.href = `/produtos/${cat.slug}`;
                    }}
                  />
                )
              ) : groupedByCategory ? (
                groupedByCategory.map(
                  ({ category, products: catProducts }, index) => (
                    <CatalogCategorySection
                      key={category.id}
                      name={category.name}
                      slug={category.slug}
                      productCount={catProducts.length}
                      animationIndex={index}
                    >
                      {renderProductGrid(catProducts)}
                    </CatalogCategorySection>
                  )
                )
              ) : (
                <CatalogProductsShell>
                  {renderProductGrid(filtered)}
                </CatalogProductsShell>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
