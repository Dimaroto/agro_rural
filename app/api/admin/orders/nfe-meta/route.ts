import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Lookup leve: chave NF-e → cliente / código da venda. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("chaves") ?? "";
  const chaves = raw
    .split(",")
    .map((c) => c.replace(/\D/g, ""))
    .filter((c) => c.length === 44)
    .slice(0, 80);

  if (chaves.length === 0) {
    return NextResponse.json({ byChave: {} });
  }

  const orders = await prisma.order.findMany({
    where: {
      storeId: session.user.storeId,
      nfeChave: { in: chaves },
    },
    select: {
      nfeChave: true,
      orderNumber: true,
      customerName: true,
      id: true,
    },
  });

  const byChave: Record<
    string,
    { orderId: string; orderNumber: number | null; customerName: string | null }
  > = {};
  for (const o of orders) {
    const key = (o.nfeChave ?? "").replace(/\D/g, "");
    if (key.length === 44) {
      byChave[key] = {
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
      };
    }
  }

  return NextResponse.json({ byChave });
}
