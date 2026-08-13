import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireFinanceAuth,
  resolveFinanceCategoryId,
} from "@/lib/finance-api-auth";

const patchSchema = z.object({
  amountCents: z.number().int().positive().optional(),
  description: z.string().min(1).max(500).optional(),
  categoryId: z.string().nullable().optional(),
  entryDate: z.string().datetime().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireFinanceAuth();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.financialEntry.findFirst({
    where: { id, storeId: authResult.storeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });
  }

  let categoryId = body.data.categoryId;
  if (body.data.categoryId !== undefined) {
    const category = await resolveFinanceCategoryId(
      authResult.storeId,
      body.data.categoryId
    );
    if ("error" in category) return category.error;
    categoryId = category.categoryId;
  }

  const entry = await prisma.financialEntry.update({
    where: { id },
    data: {
      amountCents: body.data.amountCents,
      description: body.data.description,
      categoryId,
      entryDate: body.data.entryDate ? new Date(body.data.entryDate) : undefined,
    },
    include: { category: true },
  });

  return NextResponse.json(entry);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireFinanceAuth();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  const existing = await prisma.financialEntry.findFirst({
    where: { id, storeId: authResult.storeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Lançamento não encontrado" }, { status: 404 });
  }

  await prisma.financialEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
