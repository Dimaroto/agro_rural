import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { allocateProductCode } from "@/lib/product-code";
import { publicErrorJson } from "@/lib/public-api-error";
import { productFieldsSchema } from "@/lib/party-favor-fields";
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
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Informe o nome do produto"),
  description: z.string().optional(),
  priceCents: z
    .number({ error: "Informe um preço válido" })
    .int()
    .positive("O preço deve ser maior que zero"),
  quantity: z.number().int().min(0).optional().default(0),
  categoryIds: z
    .array(z.string().min(1))
    .min(1, "Selecione ao menos uma categoria"),
  imageUrl: z.string().optional().nullable(),
  extraImageUrls: z.array(z.string().min(1)).max(2).optional().default([]),
  customizationFields: productFieldsSchema.optional().default([]),
  measures: productMeasuresSchema.optional().default([]),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const q = searchParams.get("q")?.trim() ?? "";
  const light = searchParams.get("light") === "1";

  if (light || q) {
    const idFilter = searchParams.get("id")?.trim() ?? "";
    if (idFilter) {
      const product = await prisma.product.findFirst({
        where: { id: idFilter, storeId: session.user.storeId },
        select: {
          id: true,
          name: true,
          code: true,
          imageUrl: true,
          priceCents: true,
          custoCents: true,
          active: true,
        },
      });
      return NextResponse.json(product ? [product] : []);
    }

    const codeNum = /^\d+$/.test(q) ? Number.parseInt(q, 10) : null;
    const products = await prisma.product.findMany({
      where: {
        storeId: session.user.storeId,
        ...(categoryId
          ? {
              OR: [
                { categoryId },
                { categoryLinks: { some: { categoryId } } },
              ],
            }
          : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                ...(codeNum != null && Number.isFinite(codeNum)
                  ? [{ code: codeNum }]
                  : []),
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        imageUrl: true,
        priceCents: true,
        custoCents: true,
        active: true,
      },
      orderBy: { name: "asc" },
      take: q ? 20 : 100,
    });
    return NextResponse.json(products);
  }

  const products = await prisma.product.findMany({
    where: {
      storeId: session.user.storeId,
      ...(categoryId
        ? {
            OR: [
              { categoryId },
              { categoryLinks: { some: { categoryId } } },
            ],
          }
        : {}),
    },
    include: {
      category: true,
      ...productCategoriesInclude,
      ...productFieldsInclude,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const product = await prisma.$transaction(async (tx) => {
      const code = await allocateProductCode(tx, session.user.storeId!);
      const p = await tx.product.create({
        data: {
          storeId: session.user.storeId!,
          categoryId: body.data.categoryIds[0],
          name: body.data.name,
          code,
          description: body.data.description,
          priceCents: body.data.priceCents,
          quantity: body.data.quantity,
          imageUrl: body.data.imageUrl ?? undefined,
          extraImageUrls: body.data.extraImageUrls ?? [],
        },
      });

      await replaceProductCategories(
        tx,
        p.id,
        session.user.storeId!,
        body.data.categoryIds
      );

      await replaceProductCustomizationFields(
        tx,
        p.id,
        body.data.customizationFields
      );

      await replaceProductMeasures(tx, p.id, body.data.measures);

      return tx.product.findUnique({
        where: { id: p.id },
        include: {
          category: true,
          ...productCategoriesInclude,
          ...productFieldsInclude,
        },
      });
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return publicErrorJson(
      "admin:products:create",
      error,
      "Não foi possível salvar o produto. Verifique os dados e tente novamente."
    );
  }
}
