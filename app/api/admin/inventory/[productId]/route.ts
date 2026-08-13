import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  adjustStock,
  availableStock,
  manualStockIn,
  manualStockOut,
} from "@/lib/inventory";
import { notifyStockLevel } from "@/lib/admin-push-dispatch";
import { publicErrorJson } from "@/lib/public-api-error";
import { z } from "zod";

const movementSchema = z.object({
  type: z.enum(["in", "out", "adjust"]),
  quantity: z.number().int(),
  note: z.string().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { productId } = await params;
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: session.user.storeId },
    select: {
      id: true,
      name: true,
      quantity: true,
      reservedQuantity: true,
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const movements = await prisma.inventoryMovement.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    product: {
      ...product,
      available: availableStock(product),
    },
    movements,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { productId } = await params;
  const body = movementSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    let balance: number;
    switch (body.data.type) {
      case "in":
        balance = await manualStockIn(
          session.user.storeId,
          productId,
          body.data.quantity,
          body.data.note
        );
        break;
      case "out":
        balance = await manualStockOut(
          session.user.storeId,
          productId,
          body.data.quantity,
          body.data.note
        );
        break;
      case "adjust":
        balance = await adjustStock(
          session.user.storeId,
          productId,
          body.data.quantity,
          body.data.note
        );
        break;
    }
    await notifyStockLevel({
      storeId: session.user.storeId,
      productId,
      eventId: `manual:${body.data.type}:${Date.now()}`,
    });
    return NextResponse.json({ balance });
  } catch (e) {
    return publicErrorJson(
      "admin:inventory",
      e,
      "Não foi possível atualizar o estoque. Tente novamente."
    );
  }
}
