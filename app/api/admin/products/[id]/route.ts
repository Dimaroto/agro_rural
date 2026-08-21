import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProductStockUnitColumn } from "@/lib/ensure-product-stock-unit";
import { productFieldsSchema } from "@/lib/party-favor-fields";
import { publicErrorJson } from "@/lib/public-api-error";
import {
  productCategoriesInclude,
  replaceProductCategories,
} from "@/lib/product-categories";
import {
  productFieldsInclude,
  replaceProductCustomizationFields,
} from "@/lib/product-fields-persist";
import {
  productMeasuresSchema,
  replaceProductMeasures,
} from "@/lib/product-measures";
import { isValidBarcode, normalizeBarcode } from "@/lib/product-barcode";

const updateSchema = z.object({
  name: z.string().min(1, "Informe o nome do produto").optional(),
  description: z.string().nullable().optional(),
  barcode: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? undefined : normalizeBarcode(v)))
    .refine((v) => v === undefined || v == null || isValidBarcode(v), {
      message: "Código de barras deve ter entre 8 e 14 dígitos",
    }),
  priceCents: z
    .number({ error: "Informe um preço válido" })
    .int()
    .positive("O preço deve ser maior que zero")
    .optional(),
  quantity: z.number().int().min(0).optional(),
  stockUnit: z.enum(["UN", "KG"]).optional(),
  categoryIds: z
    .array(z.string().min(1))
    .min(1, "Selecione ao menos uma categoria")
    .optional(),
  imageUrl: z.string().nullable().optional(),
  extraImageUrls: z.array(z.string().min(1)).max(2).optional(),
  active: z.boolean().optional(),
  customizationFields: productFieldsSchema.optional(),
  measures: productMeasuresSchema.optional(),
  ncm: z.string().optional().nullable(),
  cfopDefault: z.string().optional().nullable(),
  csosn: z.string().optional().nullable(),
  origemMercadoria: z.string().optional().nullable(),
  unidadeComercial: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  await ensureProductStockUnitColumn();
  const body = updateSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.product.findFirst({
    where: { id, storeId: session.user.storeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const {
    customizationFields,
    measures,
    categoryIds,
    ...productData
  } = body.data;

  if (
    productData.stockUnit === "KG" &&
    (productData.unidadeComercial === undefined
      ? existing.unidadeComercial === "UN" || !existing.unidadeComercial
      : productData.unidadeComercial === "UN" || !productData.unidadeComercial)
  ) {
    productData.unidadeComercial = "KG";
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: productData,
      });

      if (categoryIds !== undefined) {
        await replaceProductCategories(
          tx,
          id,
          session.user.storeId!,
          categoryIds
        );
      }

      if (customizationFields !== undefined) {
        await replaceProductCustomizationFields(
          tx,
          id,
          customizationFields ?? []
        );
      }

      if (measures !== undefined) {
        await replaceProductMeasures(tx, id, measures ?? []);
      }

      return tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          ...productCategoriesInclude,
          ...productFieldsInclude,
        },
      });
    });

    return NextResponse.json(product);
  } catch (error) {
    return publicErrorJson(
      "admin:products:update",
      error,
      "Não foi possível atualizar o produto. Verifique os dados e tente novamente."
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, storeId: session.user.storeId },
  });

  if (!product) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { productId: id },
        data: { productId: null },
      });
      await tx.inventoryMovement.deleteMany({ where: { productId: id } });
      await tx.productCategory.deleteMany({ where: { productId: id } });
      await tx.productCustomizationFieldOption.deleteMany({
        where: { field: { productId: id } },
      });
      await tx.productCustomizationField.deleteMany({
        where: { productId: id },
      });
      await tx.product.delete({ where: { id } });
    });
  } catch (error) {
    return publicErrorJson(
      "admin:products:delete",
      error,
      "Não foi possível excluir o produto. Tente novamente."
    );
  }

  return NextResponse.json({ ok: true, deleted: true });
}
