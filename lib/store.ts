import { cache } from "react";
import { prisma } from "./db";
import { getStockStatus } from "./format";
import { availableStock } from "./inventory";
import type { ProductFieldView } from "./party-favor-fields";
import {
  mapProductCategories,
  productCategoriesInclude,
} from "./product-categories";
import {
  productFieldsInclude,
  projectProductFields,
} from "./product-fields-persist";
import { formatMeasureLabel } from "./product-measures";
import type { ProductMeasureUnit } from "@prisma/client";

const DEFAULT_STORE_SLUG =
  process.env.DEFAULT_STORE_SLUG?.trim() ||
  process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG?.trim() ||
  "saboart";

export type CatalogProductCategory = {
  id: string;
  name: string;
  slug: string;
};

export type CatalogProductData = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  extraImageUrls: string[];
  categoryId: string;
  categoryIds: string[];
  categoryName: string;
  categorySlug: string;
  categories: CatalogProductCategory[];
  stockStatus: ReturnType<typeof getStockStatus>;
  available: number;
  quantity: number;
  reservedQuantity: number;
  createdAt: string;
  customizationFields: ProductFieldView[];
  measures: string[];
};

function mapCatalogProduct(p: {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  extraImageUrls?: string[];
  categoryId: string;
  quantity?: number;
  reservedQuantity?: number;
  createdAt: Date;
  category: { name: string; slug: string };
  categoryLinks?: Array<{
    category: {
      id: string;
      name: string;
      slug: string;
      sortOrder?: number;
      active?: boolean;
    };
  }>;
  customizationFields?: Array<{
    id: string;
    label: string;
    type: "TEXT" | "SELECT";
    required: boolean;
    sortOrder: number;
    options: Array<{ id: string; label: string; sortOrder: number }>;
  }>;
  measures?: Array<{
    value?: number | null;
    width?: number | null;
    length?: number | null;
    height?: number | null;
    unit: ProductMeasureUnit;
    sortOrder: number;
  }>;
}): CatalogProductData {
  const quantity = p.quantity ?? 0;
  const reservedQuantity = p.reservedQuantity ?? 0;
  const available = availableStock({ quantity, reservedQuantity });
  const stockStatus = getStockStatus(available, 0, 5);
  const categories = mapProductCategories(p.categoryLinks);
  const primary =
    categories.find((category) => category.id === p.categoryId) ??
    categories[0] ?? {
      id: p.categoryId,
      name: p.category.name,
      slug: p.category.slug,
    };
  const categoryIds =
    categories.length > 0
      ? categories.map((category) => category.id)
      : [p.categoryId];
  const measureLabels = [...(p.measures ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => formatMeasureLabel(m));

  return {
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    imageUrl: p.imageUrl,
    extraImageUrls: (p.extraImageUrls ?? []).filter(Boolean).slice(0, 2),
    categoryId: primary.id,
    categoryIds,
    categoryName: primary.name,
    categorySlug: primary.slug,
    categories:
      categories.length > 0
        ? categories
        : [{ id: primary.id, name: primary.name, slug: primary.slug }],
    stockStatus,
    available,
    quantity,
    reservedQuantity,
    createdAt: p.createdAt.toISOString(),
    customizationFields: projectProductFields(p.customizationFields),
    measures: measureLabels,
  };
}

const catalogListInclude = {
  category: true,
  ...productCategoriesInclude,
  measures: {
    select: {
      value: true,
      width: true,
      length: true,
      height: true,
      unit: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
};

const catalogProductInclude = {
  category: true,
  ...productCategoriesInclude,
  ...productFieldsInclude,
  measures: {
    select: {
      value: true,
      width: true,
      length: true,
      height: true,
      unit: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" as const },
  },
};

export const getDefaultStore = cache(async () => {
  return getStoreBySlug(DEFAULT_STORE_SLUG);
});

export async function getStoreBySlug(slug: string) {
  return prisma.store.findFirst({
    where: { slug, active: true },
  });
}

export async function getCategoryBySlug(storeId: string, categorySlug: string) {
  return prisma.category.findFirst({
    where: { storeId, slug: categorySlug, active: true },
  });
}

export async function getProductById(storeId: string, productId: string) {
  const p = await prisma.product.findFirst({
    where: { id: productId, storeId, active: true },
    include: catalogProductInclude,
  });

  if (!p) return null;
  return mapCatalogProduct(p);
}

/** Catálogo para vitrine: dedupe por request (layout + page). */
export const getStoreCatalog = cache(async (storeId: string) => {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { storeId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.product.findMany({
      where: { storeId, active: true },
      include: catalogListInclude,
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    categories,
    products: products.map((p) =>
      mapCatalogProduct({
        ...p,
        customizationFields: [],
      })
    ),
  };
});
