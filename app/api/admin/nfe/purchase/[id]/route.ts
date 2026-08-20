import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFinanceAuth } from "@/lib/finance-api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const invoice = await prisma.purchaseInvoice.findFirst({
    where: { id, storeId: authz.storeId },
    include: {
      supplier: true,
      items: { orderBy: { lineNumber: "asc" }, include: { product: true } },
      ledgerEntries: { orderBy: { entryDate: "asc" } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ invoice });
}
