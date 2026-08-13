import { NextResponse } from "next/server";
import { z } from "zod";
import { PayableStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireFinanceAuth,
  resolveFinanceCategoryId,
} from "@/lib/finance-api-auth";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  amountCents: z.number().int().positive(),
  dueDate: z.string().datetime(),
  categoryId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET() {
  const authResult = await requireFinanceAuth();
  if ("error" in authResult) return authResult.error;

  const payables = await prisma.payableAccount.findMany({
    where: { storeId: authResult.storeId },
    include: { category: true },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(payables);
}

export async function POST(req: Request) {
  const authResult = await requireFinanceAuth();
  if ("error" in authResult) return authResult.error;

  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const category = await resolveFinanceCategoryId(
    authResult.storeId,
    body.data.categoryId
  );
  if ("error" in category) return category.error;

  const payable = await prisma.payableAccount.create({
    data: {
      storeId: authResult.storeId,
      title: body.data.title,
      amountCents: body.data.amountCents,
      dueDate: new Date(body.data.dueDate),
      categoryId: category.categoryId,
      notes: body.data.notes ?? null,
      status: PayableStatus.PENDING,
    },
    include: { category: true },
  });

  return NextResponse.json(payable, { status: 201 });
}
