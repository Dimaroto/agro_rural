import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureProductStockUnitColumn } from "@/lib/ensure-product-stock-unit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { allocateProductCode, formatProductCode } from "@/lib/product-code";
import { isValidBarcode, normalizeBarcode } from "@/lib/product-barcode";
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
import { searchIncludes } from "@/lib/search-text";

const barcodeSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v) => normalizeBarcode(v))
  .refine((v) => v == null || isValidBarcode(v), {
    message: "Código de barras deve ter entre 8 e 14 dígitos",
  });

const createSchema = z.object({
  name: z.string().min(1, "Informe o nome do produto"),
  description: z.string().optional(),
  barcode: barcodeSchema,
  priceCents: z
    .number({ error: "Informe um preço válido" })
    .int()
    .positive("O preço deve ser maior que zero"),
  quantity: z.number().int().min(0).optional().default(0),
  stockUnit: z.enum(["UN", "KG"]).optional().default("UN"),
  categoryIds: z
    .array(z.string().min(1))
    .min(1, "Selecione ao menos uma categoria"),
  imageUrl: z.string().optional().nullable(),
  extraImageUrls: z.array(z.string().min(1)).max(2).optional().default([]),
  customizationFields: productFieldsSchema.optional().default([]),
  measures: productMeasuresSchema.optional().default([]),
  ncm: z.string().optional().nullable(),
  cfopDefault: z.string().optional().nullable(),
  csosn: z.string().optional().nullable(),
  origemMercadoria: z.string().optional().nullable(),
  unidadeComercial: z.string().optional().nullable(),
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
    const barcodeDigits = q.replace(/\D/g, "");
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
      select: {
        id: true,
        name: true,
        code: true,
        barcode: true,
        imageUrl: true,
        priceCents: true,
        custoCents: true,
        active: true,
      },
      orderBy: { name: "asc" },
      take: q ? 1000 : 100,
    });
    const filtered = q
      ? products.filter((p) => {
          if (codeNum != null && Number.isFinite(codeNum) && p.code === codeNum) {
            return true;
          }
          if (barcodeDigits && p.barcode?.includes(barcodeDigits)) return true;
          return (
            searchIncludes(p.name, q) ||
            searchIncludes(formatProductCode(p.code), q)
          );
        })
      : products;
    return NextResponse.json(filtered.slice(0, q ? 20 : 100));
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

  await ensureProductStockUnitColumn();

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
          barcode: body.data.barcode ?? null,
          description: body.data.description,
          priceCents: body.data.priceCents,
          quantity: body.data.quantity,
          stockUnit: body.data.stockUnit,
          imageUrl: body.data.imageUrl ?? undefined,
          extraImageUrls: body.data.extraImageUrls ?? [],
          ncm: body.data.ncm ?? null,
          cfopDefault: body.data.cfopDefault ?? "5102",
          csosn: body.data.csosn ?? "102",
          origemMercadoria: body.data.origemMercadoria ?? "0",
          unidadeComercial:
            body.data.stockUnit === "KG" &&
            (body.data.unidadeComercial ?? "UN") === "UN"
              ? "KG"
              : (body.data.unidadeComercial ?? "UN"),
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
