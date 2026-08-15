import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publicErrorJson } from "@/lib/public-api-error";

const bodySchema = z.object({
  nfeChave: z.string().nullable().optional(),
  nfeStatus: z.string().nullable().optional(),
  nfeNumero: z.number().int().nullable().optional(),
  nfeModelo: z.number().int().nullable().optional(),
  nfeProtocolo: z.string().nullable().optional(),
  nfeEmitidoAt: z.string().datetime().nullable().optional(),
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
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  try {
    const existing = await prisma.order.findFirst({
      where: { id, storeId: session.user.storeId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Venda não encontrada" }, { status: 404 });
    }

    const data = parsed.data;
    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(data.nfeChave !== undefined ? { nfeChave: data.nfeChave } : {}),
        ...(data.nfeStatus !== undefined ? { nfeStatus: data.nfeStatus } : {}),
        ...(data.nfeNumero !== undefined ? { nfeNumero: data.nfeNumero } : {}),
        ...(data.nfeModelo !== undefined ? { nfeModelo: data.nfeModelo } : {}),
        ...(data.nfeProtocolo !== undefined
          ? { nfeProtocolo: data.nfeProtocolo }
          : {}),
        ...(data.nfeEmitidoAt !== undefined
          ? {
              nfeEmitidoAt: data.nfeEmitidoAt
                ? new Date(data.nfeEmitidoAt)
                : null,
            }
          : {}),
      },
      select: {
        id: true,
        nfeChave: true,
        nfeStatus: true,
        nfeNumero: true,
        nfeModelo: true,
        nfeProtocolo: true,
        nfeEmitidoAt: true,
      },
    });

    return NextResponse.json(order);
  } catch (error) {
    return publicErrorJson(
      "admin:orders:nfe-status",
      error,
      "Não foi possível salvar o status da NF-e."
    );
  }
}
