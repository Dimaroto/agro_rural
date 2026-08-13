"use client";

import { useMemo, useState } from "react";
import {
  AdminProductCard,
  type AdminProductItem,
} from "@/components/admin/AdminProductCard";
import { formatProductCode, parseProductCodeQuery } from "@/lib/product-code";

type SortMode = "alpha" | "newest" | "oldest";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesProduct(product: AdminProductItem, query: string) {
  const q = normalize(query);
  if (!q) return true;

  const codeQuery = parseProductCodeQuery(query);
  if (codeQuery != null && product.code === codeQuery) return true;

  const haystack = [
    product.name,
    product.description ?? "",
    product.category.name,
    ...(product.categories?.map((category) => category.name) ?? []),
    product.code != null ? formatProductCode(product.code) : "",
    product.code != null ? String(product.code) : "",
    product.active ? "ativo" : "inativo",
  ]
    .map(normalize)
    .join(" ");

  return haystack.includes(q);
}

function sortProducts(products: AdminProductItem[], mode: SortMode) {
  const list = [...products];
  if (mode === "alpha") {
    return list.sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );
  }
  return list.sort((a, b) => {
    const diff =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return mode === "newest" ? -diff : diff;
  });
}

export function AdminProductsList({
  products,
}: {
  products: AdminProductItem[];
}) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("alpha");

  const filtered = useMemo(() => {
    const matched = products.filter((product) =>
      matchesProduct(product, query)
    );
    return sortProducts(matched, sortMode);
  }, [products, query, sortMode]);

  return (
    <div className="space-y-4">
      <div className="admin-card space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="admin-products-search">
            Buscar produto
          </label>
          <input
            id="admin-products-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="admin-input w-full flex-1 px-4 py-3 text-base"
            placeholder="Buscar por nome, código ou categoria…"
            autoComplete="off"
          />
          <div className="sm:w-52">
            <label className="sr-only" htmlFor="admin-products-sort">
              Ordenar por
            </label>
            <select
              id="admin-products-sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="admin-input w-full px-3 py-3 text-sm"
            >
              <option value="alpha">Alfabético</option>
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
            </select>
          </div>
        </div>
        {query.trim() && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {filtered.length === 0
              ? "Nenhum produto encontrado"
              : `${filtered.length} produto${filtered.length === 1 ? "" : "s"}`}
          </p>
        )}
      </div>

      <ul className="admin-card divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
        {filtered.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {query.trim()
              ? "Nenhum produto corresponde à busca."
              : "Nenhum produto cadastrado."}
          </li>
        ) : (
          filtered.map((product) => (
            <AdminProductCard key={product.id} product={product} />
          ))
        )}
      </ul>
    </div>
  );
}
