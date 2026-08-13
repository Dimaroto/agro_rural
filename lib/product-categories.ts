import type { Prisma } from "@prisma/client";
import { PublicApiError } from "./public-api-error";

export const productCategoriesInclude = {
  categoryLinks: {
    include: {
      category: {
        select: { id: true, name: true, slug: true, sortOrder: true, active: true },
      },
    },
  },
} satisfies Prisma.ProductInclude;

type Tx = Prisma.TransactionClient;

export async function replaceProductCategories(
  tx: Tx,
  productId: string,
  storeId: string,
  categoryIdsInput: string[] | undefined
) {
  const uniqueIds = [
    ...new Set(
      (categoryIdsInput ?? [])
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    ),
  ];

  if (uniqueIds.length === 0) {
    throw new PublicApiError("Selecione ao menos uma categoria");
  }

  const categories = await tx.category.findMany({
    where: { storeId, id: { in: uniqueIds } },
    select: { id: true },
  });
  if (categories.length !== uniqueIds.length) {
    throw new PublicApiError("Uma ou mais categorias são inválidas");
  }

  // Mantém a ordem enviada pelo formulário.
  const orderedIds = uniqueIds.filter((id) =>
    categories.some((category) => category.id === id)
  );

  await tx.productCategory.deleteMany({ where: { productId } });
  await tx.productCategory.createMany({
    data: orderedIds.map((categoryId) => ({ productId, categoryId })),
  });
  await tx.product.update({
    where: { id: productId },
    data: { categoryId: orderedIds[0] },
  });

  return orderedIds;
}

export function mapProductCategories(
  links:
    | Array<{
        category: {
          id: string;
          name: string;
          slug: string;
          sortOrder?: number;
          active?: boolean;
        };
      }>
    | undefined
) {
  if (!links?.length) return [];
  return links
    .map((link) => link.category)
    .filter((category) => category.active !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}
