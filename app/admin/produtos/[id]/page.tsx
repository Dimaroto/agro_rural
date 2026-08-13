import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductEditClient } from "@/components/admin/ProductEditClient";
import { mapProductMeasuresToView } from "@/lib/product-measures";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id, storeId: session.user.storeId },
      include: {
        categoryLinks: {
          include: {
            category: {
              select: { id: true, name: true, slug: true, sortOrder: true },
            },
          },
        },
        measures: {
          orderBy: [{ sortOrder: "asc" }],
        },
        customizationFields: {
          include: {
            options: {
              orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            },
          },
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        },
      },
    }),
    prisma.category.findMany({
      where: { storeId: session.user.storeId, active: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!product) notFound();

  const categoryIds =
    product.categoryLinks.length > 0
      ? product.categoryLinks.map((link) => link.categoryId)
      : [product.categoryId];

  const formProduct = {
    ...product,
    categoryIds,
    measures: mapProductMeasuresToView(product.measures),
    customizationFields: product.customizationFields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      required: field.required,
      sortOrder: field.sortOrder,
      options: field.options.map((option) => ({
        id: option.id,
        label: option.label,
        sortOrder: option.sortOrder,
      })),
    })),
  };

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/produtos"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Voltar para produtos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Editar produto
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {product.name}
        </p>
      </header>

      <ProductEditClient
        categories={categories}
        product={formProduct}
      />
    </div>
  );
}
