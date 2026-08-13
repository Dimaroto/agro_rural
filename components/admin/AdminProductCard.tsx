"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice, getStockStatus } from "@/lib/format";
import { formatProductCode } from "@/lib/product-code";
import { availableStock } from "@/lib/inventory";
import { StockBadge } from "@/components/StockBadge";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { PackageIcon } from "@/components/icons/UiIcons";

export type AdminProductItem = {
  id: string;
  name: string;
  code?: number;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
  category: { name: string };
  categories?: Array<{ name: string }>;
  quantity: number;
  reservedQuantity: number;
};

export function AdminProductCard({ product }: { product: AdminProductItem }) {
  const available = availableStock(product);
  const stockStatus = getStockStatus(available, 0, 5);
  const codeLabel =
    product.code != null ? formatProductCode(product.code) : null;
  const categoryNames =
    product.categories?.map((category) => category.name) ??
    [product.category.name];

  return (
    <li
      className={`flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4 ${
        product.active ? "" : "opacity-70"
      }`}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800 sm:h-16 sm:w-16">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-300">
            <PackageIcon className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {codeLabel && (
            <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              {codeLabel}
            </span>
          )}
          {categoryNames.map((name) => (
            <span
              key={name}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {name}
            </span>
          ))}
          {!product.active && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
              Inativo
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {product.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            {formatPrice(product.priceCents)}
          </p>
          <StockBadge status={stockStatus} available={available} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/admin/produtos/${product.id}`}
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:px-4"
        >
          Editar
        </Link>
        <DeleteProductButton
          productId={product.id}
          productName={product.name}
          compact
        />
      </div>
    </li>
  );
}
