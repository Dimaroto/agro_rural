"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { ProductForm } from "@/components/admin/ProductForm";

type ProductFormProps = ComponentProps<typeof ProductForm>;

export function ProductEditClient({
  categories,
  product,
}: {
  categories: ProductFormProps["categories"];
  product: NonNullable<ProductFormProps["product"]>;
}) {
  const [livePriceCents, setLivePriceCents] = useState(product.priceCents);

  useEffect(() => {
    setLivePriceCents(product.priceCents);
  }, [product.priceCents]);

  return (
    <ProductForm
      categories={categories}
      product={{ ...product, priceCents: livePriceCents }}
      onPriceCentsChange={setLivePriceCents}
    />
  );
}
