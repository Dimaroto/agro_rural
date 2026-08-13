import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  adminCancelOrder,
  adminConfirmReceivablePayment,
  adminDeliverOrder,
} from "@/lib/order-admin";
import { publicErrorJson } from "@/lib/public-api-error";

const actionSchema = z.object({
  action: z.enum(["deliver", "cancel", "confirm_payment"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = actionSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id, storeId: session.user.storeId },
    select: { id: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  try {
    let updated;
    if (body.data.action === "deliver") {
      updated = await adminDeliverOrder(session.user.storeId, id);
    } else if (body.data.action === "confirm_payment") {
      updated = await adminConfirmReceivablePayment(session.user.storeId, id);
    } else {
      updated = await adminCancelOrder(session.user.storeId, id);
    }

    return NextResponse.json(updated);
  } catch (error) {
    return publicErrorJson(
      "admin:orders:patch",
      error,
      "Não foi possível atualizar o pedido. Tente novamente."
    );
  }
}
