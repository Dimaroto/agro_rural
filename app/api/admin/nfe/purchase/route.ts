import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireFinanceAuth } from "@/lib/finance-api-auth";

export async function GET(req: Request) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const take = Math.min(
    100,
    Number(new URL(req.url).searchParams.get("take") ?? "40") || 40
  );
  const invoices = await prisma.purchaseInvoice.findMany({
    where: { storeId: authz.storeId },
    orderBy: { importedAt: "desc" },
    take,
    include: {
      supplier: { select: { id: true, name: true, document: true } },
      _count: { select: { items: true, ledgerEntries: true } },
    },
  });
  return NextResponse.json({ invoices });
}
