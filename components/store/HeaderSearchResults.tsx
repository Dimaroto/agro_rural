"use client";

import Image from "next/image";
import { useMemo } from "react";
import { formatPrice } from "@/lib/format";
import {
  buildHeaderSearchGroups,
  type HeaderSearchCategory,
  type HeaderSearchProduct,
} from "@/lib/header-search-products";
import { isPhotoImageUrl } from "@/lib/image-url";
import { ProductPlaceholder } from "@/components/icons/UiIcons";
import { useProductDetail } from "@/lib/product-detail-context";

type HeaderSearchResultsProps = {
  query: string;
  products: HeaderSearchProduct[];
  categories: HeaderSearchCategory[];
  onSelect: () => void;
};

export function HeaderSearchResults({
  query,
  products,
  categories,
  onSelect,
}: HeaderSearchResultsProps) {
  const { openProductById } = useProductDetail();
  const groups = useMemo(
    () => buildHeaderSearchGroups(query, products, categories),
    [query, products, categories]
  );

  if (query.trim().length < 2) return null;

  return (
    <div
      className="catalog-search-results"
      role="listbox"
      aria-label="Resultados da busca"
    >
      {groups.length === 0 ? (
        <p className="catalog-search-results__empty">
          Nenhum produto encontrado para &ldquo;{query.trim()}&rdquo;
        </p>
      ) : (
        groups.map(({ category, products: catProducts }) => (
          <div key={category.id} className="catalog-search-results__group">
            <p className="catalog-search-results__cat">{category.name}</p>
            <ul className="catalog-search-results__list">
              {catProducts.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    className={`catalog-search-results__item ${
                      product.stockStatus === "out_of_stock"
                        ? "catalog-search-results__item--out"
                        : ""
                    }`}
                    role="option"
                    onClick={() => {
                      openProductById(product.id);
                      onSelect();
                    }}
                  >
                    <span className="catalog-search-results__thumb">
                      {isPhotoImageUrl(product.imageUrl) && product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <ProductPlaceholder className="h-5 w-5 text-brand/40" />
                      )}
                    </span>
                    <span className="catalog-search-results__info">
                      <span className="catalog-search-results__name">
                        {product.name}
                      </span>
                      <span className="catalog-search-results__price">
                        {formatPrice(product.priceCents)}
                      </span>
                    </span>
                    {product.stockStatus === "out_of_stock" && (
                      <span className="catalog-search-results__badge">
                        Esgotado
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
