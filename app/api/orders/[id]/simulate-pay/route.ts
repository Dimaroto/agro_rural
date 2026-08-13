import { NextResponse } from "next/server";
import { confirmOrderPayment } from "@/lib/orders";
import { prisma } from "@/lib/db";

/** Simula confirmação de pagamento apenas em desenvolvimento (provedor mock). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Não disponível" }, { status: 403 });
  }

  const { id: orderId } = await params;
  const payment = await prisma.payment.findFirst({
    where: {
      orderId,
      provider: "mock",
    },
  });

  if (!payment?.externalId) {
    return NextResponse.json(
      { error: "Pagamento mock não encontrado" },
      { status: 404 }
    );
  }

  await confirmOrderPayment(payment.externalId, "mock", { orderId });
  return NextResponse.json({ ok: true });
}
