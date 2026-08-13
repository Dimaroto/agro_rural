import { NextResponse } from "next/server";
import { z } from "zod";
import { FinancialEntryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  requireFinanceAuth,
  resolveFinanceCategoryId,
} from "@/lib/finance-api-auth";

const createSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amountCents: z.number().int().positive(),
  description: z.string().min(1).max(500),
  categoryId: z.string().optional().nullable(),
  entryDate: z.string().datetime().optional(),
});

export async function GET() {
  const authResult = await requireFinanceAuth();
  if ("error" in authResult) return authResult.error;

  const entries = await prisma.financialEntry.findMany({
    where: { storeId: authResult.storeId },
    include: { category: true },
    orderBy: { entryDate: "desc" },
  });

  return NextResponse.json(entries);
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

  const entry = await prisma.financialEntry.create({
    data: {
      storeId: authResult.storeId,
      type: body.data.type as FinancialEntryType,
      amountCents: body.data.amountCents,
      description: body.data.description,
      categoryId: category.categoryId,
      entryDate: body.data.entryDate ? new Date(body.data.entryDate) : new Date(),
      source: "MANUAL",
    },
    include: { category: true },
  });

  return NextResponse.json(entry, { status: 201 });
}
