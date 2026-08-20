import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import { confirmLedgerEntry, todayIsoDay } from "@/lib/finance-ledger";
import { publicErrorJson } from "@/lib/public-api-error";

const confirmSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amountCents: z.number().int().positive().optional(),
  paymentMethod: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "confirm";

  try {
    if (action === "confirm") {
      const body = confirmSchema.safeParse(await req.json().catch(() => ({})));
      if (!body.success) {
        return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
      }
      const entry = await confirmLedgerEntry(authz.storeId, id, {
        entryDate: body.data.entryDate ?? todayIsoDay(),
        amountCents: body.data.amountCents,
        paymentMethod: body.data.paymentMethod,
      });
      return NextResponse.json({ entry });
    }
    if (action === "delete") {
      const existing = await prisma.financialLedgerEntry.findFirst({
        where: { id, storeId: authz.storeId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
      }
      await prisma.financialLedgerEntry.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e) {
    return publicErrorJson("admin:finance:ledger:id", e, "Não foi possível atualizar o lançamento.");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const existing = await prisma.financialLedgerEntry.findFirst({
    where: { id, storeId: authz.storeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  await prisma.financialLedgerEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
