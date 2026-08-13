import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-session";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { formatOrderCode } from "@/lib/order-number";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  AWAITING_PIX: "Aguardando PIX",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

export async function GET() {
  const customer = await getCustomerSession();
  if (!customer) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    include: {
      payment: { select: { status: true } },
      items: { select: { id: true } },
    },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      code: formatOrderCode(o.orderNumber, o.id),
      orderNumber: o.orderNumber,
      status: o.status,
      statusLabel: STATUS_LABELS[o.status] ?? o.status,
      totalCents: o.totalCents,
      totalFormatted: formatPrice(o.totalCents),
      itemCount: o.items.length,
      createdAt: o.createdAt.toISOString(),
      paymentStatus: o.payment?.status ?? null,
    })),
  });
}
