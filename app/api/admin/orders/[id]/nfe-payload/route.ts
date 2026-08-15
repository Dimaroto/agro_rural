import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildAgroNfePayload } from "@/lib/nfe/build-payload";
import { publicErrorJson } from "@/lib/public-api-error";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const modeloParam = new URL(_req.url).searchParams.get("modelo");
  const modelo = modeloParam === "65" ? 65 : 55;

  try {
    const order = await prisma.order.findFirst({
      where: { id, storeId: session.user.storeId },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              select: {
                ncm: true,
                cfopDefault: true,
                csosn: true,
                origemMercadoria: true,
                unidadeComercial: true,
                barcode: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });
    }

    const payload = buildAgroNfePayload(order, modelo);
    return NextResponse.json({
      payload,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        nfeChave: order.nfeChave,
        nfeStatus: order.nfeStatus,
        nfeNumero: order.nfeNumero,
        nfeModelo: order.nfeModelo,
        nfeProtocolo: order.nfeProtocolo,
        nfeEmitidoAt: order.nfeEmitidoAt,
      },
    });
  } catch (error) {
    return publicErrorJson(
      "admin:orders:nfe-payload",
      error,
      "Não foi possível montar o payload da NF-e."
    );
  }
}
