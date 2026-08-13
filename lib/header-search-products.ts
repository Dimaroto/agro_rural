import type { StockStatus } from "@/lib/format";
import { searchIncludes } from "@/lib/search-text";

export type HeaderSearchProduct = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  priceCents: number;
  imageUrl: string | null;
  stockStatus: StockStatus;
};

export type HeaderSearchCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
};

export type HeaderSearchGroup = {
  category: HeaderSearchCategory;
  products: HeaderSearchProduct[];
};

const MAX_PRODUCTS_PER_CATEGORY = 3;
const MIN_QUERY_LENGTH = 2;

function matchesQuery(product: HeaderSearchProduct, query: string): boolean {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return false;
  return (
    searchIncludes(product.name, q) ||
    (product.description ? searchIncludes(product.description, q) : false) ||
    searchIncludes(product.categoryName, q)
  );
}

export function buildHeaderSearchGroups(
  query: string,
  products: HeaderSearchProduct[],
  categories: HeaderSearchCategory[]
): HeaderSearchGroup[] {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const sortedCategories = [...categories].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  const groups: HeaderSearchGroup[] = [];

  for (const category of sortedCategories) {
    const matched = products
      .filter(
        (p) => p.categoryId === category.id && matchesQuery(p, q)
      )
      .slice(0, MAX_PRODUCTS_PER_CATEGORY);

    if (matched.length > 0) {
      groups.push({ category, products: matched });
    }
  }

  return groups;
}
