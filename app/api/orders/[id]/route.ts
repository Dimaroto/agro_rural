import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-session";
import {
  extractOrderAccessToken,
  verifyOrderAccessToken,
} from "@/lib/order-access";
import { prisma } from "@/lib/db";
import { syncOrderPaymentFromProvider } from "@/lib/orders";
import { formatOrderCode } from "@/lib/order-number";

async function loadOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: { items: true, payment: true, store: true },
  });
}

async function canViewOrder(
  order: { id: string; storeId: string; customerId: string | null },
  req: Request
): Promise<boolean> {
  if (verifyOrderAccessToken(order.id, extractOrderAccessToken(req))) {
    return true;
  }

  const customer = await getCustomerSession();
  if (customer && order.customerId && customer.id === order.customerId) {
    return true;
  }

  const session = await auth();
  if (session?.user?.storeId && session.user.storeId === order.storeId) {
    return true;
  }

  return false;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let order = await loadOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  if (!(await canViewOrder(order, req))) {
    // 404 uniforme — evita oracle de existência de pedido.
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  // Rede de segurança: se o webhook não chegou, consulta o Mercado Pago
  if (
    order.payment &&
    (order.status === OrderStatus.AWAITING_PIX ||
      order.status === OrderStatus.AWAITING_PAYMENT)
  ) {
    try {
      await syncOrderPaymentFromProvider(order.id);
      const refreshed = await loadOrder(id);
      if (refreshed) order = refreshed;
    } catch {
      /* mantém status atual se a sync falhar */
    }
  }

  return NextResponse.json({
    id: order.id,
    code: formatOrderCode(order.orderNumber, order.id),
    orderNumber: order.orderNumber,
    status: order.status,
    totalCents: order.totalCents,
    items: order.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    payment: order.payment
      ? {
          status: order.payment.status,
          method: order.payment.method,
          pixCopyPaste: order.payment.pixCopyPaste,
          checkoutUrl: order.payment.checkoutUrl,
          paidAt: order.payment.paidAt,
        }
      : null,
    storeSlug: order.store.slug,
    storeWhatsapp: order.store.whatsapp,
  });
}
