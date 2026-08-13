import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import { getFinancialSettings } from "@/lib/finance";

const patchSchema = z.object({
  openingBalanceCents: z.number().int().optional(),
  defaultCurrency: z.string().min(3).max(3).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET() {
  const authResult = await requireFinanceAuth();
  if ("error" in authResult) return authResult.error;

  const settings = await getFinancialSettings(authResult.storeId);
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const authResult = await requireFinanceAuth();
  if ("error" in authResult) return authResult.error;

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.financialSettings.update({
    where: { storeId: authResult.storeId },
    data: body.data,
  });

  return NextResponse.json(settings);
}
