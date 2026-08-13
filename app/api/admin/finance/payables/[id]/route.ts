import { NextResponse } from "next/server";
import { z } from "zod";
import { PayableStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireFinanceAuth,
  resolveFinanceCategoryId,
} from "@/lib/finance-api-auth";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  amountCents: z.number().int().positive().optional(),
  dueDate: z.string().datetime().optional(),
  categoryId: z.string().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: z.enum(["PENDING", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  markPaid: z.boolean().optional(),
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

  const existing = await prisma.payableAccount.findFirst({
    where: { id, storeId: authResult.storeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  let status = body.data.status as PayableStatus | undefined;
  let paidAt: Date | null | undefined = undefined;
  if (body.data.markPaid) {
    status = PayableStatus.PAID;
    paidAt = new Date();
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

  const payable = await prisma.payableAccount.update({
    where: { id },
    data: {
      title: body.data.title,
      amountCents: body.data.amountCents,
      dueDate: body.data.dueDate ? new Date(body.data.dueDate) : undefined,
      categoryId,
      notes: body.data.notes,
      status,
      paidAt,
    },
    include: { category: true },
  });

  return NextResponse.json(payable);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireFinanceAuth();
  if ("error" in authResult) return authResult.error;

  const { id } = await params;
  const existing = await prisma.payableAccount.findFirst({
    where: { id, storeId: authResult.storeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  await prisma.payableAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
