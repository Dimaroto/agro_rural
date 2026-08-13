import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelExpiredOrders } from "@/lib/orders";

export async function GET() {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await cancelExpiredOrders();

  const orders = await prisma.order.findMany({
    where: { storeId: session.user.storeId },
    include: { items: true, payment: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(orders);
}
