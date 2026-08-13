import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/format";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().optional(),
  active: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  imageUrl: z.string().nullable().optional(),
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
  const body = updateSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.category.findFirst({
    where: { id, storeId: session.user.storeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const data: {
    name?: string;
    slug?: string;
    sortOrder?: number;
    active?: boolean;
    showOnHome?: boolean;
    imageUrl?: string | null;
  } = { ...body.data };

  if (body.data.name && body.data.name.trim() !== existing.name) {
    const slug = slugify(body.data.name);
    const conflict = await prisma.category.findFirst({
      where: {
        storeId: session.user.storeId,
        slug,
        NOT: { id },
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Já existe uma categoria com este nome" },
        { status: 400 }
      );
    }
    data.name = body.data.name.trim();
    data.slug = slug;
  }

  const updated = await prisma.category.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
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
  const products = await prisma.product.count({
    where: {
      storeId: session.user.storeId,
      OR: [
        { categoryId: id },
        { categoryLinks: { some: { categoryId: id } } },
      ],
    },
  });

  if (products > 0) {
    return NextResponse.json(
      { error: "Categoria possui produtos vinculados" },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.productCategory.deleteMany({ where: { categoryId: id } });
    await tx.category.deleteMany({
      where: { id, storeId: session.user.storeId },
    });
  });

  return NextResponse.json({ ok: true });
}
