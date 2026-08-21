import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import {
  buildDevolucaoPayload,
  type DevolucaoItemInput,
} from "@/lib/nfe/build-devolucao-payload";
import { publicErrorJson, PublicApiError } from "@/lib/public-api-error";
import { isOrderNfeAuthorized } from "@/lib/nfe/order-nfe-authorized";
import { manualStockOut } from "@/lib/inventory";

const confirmSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.number().positive(),
      })
    )
    .min(1),
  dryRun: z.boolean().optional(),
  nfeChave: z.string().nullable().optional(),
  nfeStatus: z.string().nullable().optional(),
  nfeNumero: z.number().int().nullable().optional(),
});

async function loadInvoice(storeId: string, id: string) {
  return prisma.purchaseInvoice.findFirst({
    where: { id, storeId },
    include: {
      supplier: true,
      items: { orderBy: { lineNumber: "asc" } },
    },
  });
}

/** Preview do payload de devolução (cliente emite no emissor local). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  try {
    const invoice = await loadInvoice(authz.storeId, id);
    if (!invoice) {
      return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });
    }
    if (
      isOrderNfeAuthorized({
        nfeStatus: invoice.returnNfeStatus,
        nfeChave: invoice.returnNfeChave,
      })
    ) {
      return NextResponse.json(
        {
          error: "Já existe devolução autorizada para esta entrada.",
          returnNfeChave: invoice.returnNfeChave,
          returnNfeNumero: invoice.returnNfeNumero,
        },
        { status: 409 }
      );
    }
    const selected: DevolucaoItemInput[] = invoice.items.map((i) => ({
      id: i.id,
      quantity: i.quantity,
    }));
    const payload = await buildDevolucaoPayload(invoice, selected);
    return NextResponse.json({
      payload,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        series: invoice.series,
        accessKey: invoice.accessKey,
        emitenteName: invoice.emitenteName,
        items: invoice.items,
        supplier: invoice.supplier,
      },
    });
  } catch (e) {
    return publicErrorJson(
      "admin:nfe:devolucao:get",
      e,
      "Não foi possível preparar a devolução."
    );
  }
}

/**
 * Confirma devolução após emissão no emissor local:
 * grava chave/status e baixa estoque dos itens devolvidos.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const body = confirmSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const invoice = await loadInvoice(authz.storeId, id);
    if (!invoice) {
      return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });
    }
    if (
      isOrderNfeAuthorized({
        nfeStatus: invoice.returnNfeStatus,
        nfeChave: invoice.returnNfeChave,
      })
    ) {
      throw new PublicApiError(
        "Já existe devolução autorizada para esta entrada."
      );
    }

    // Valida quantidades / payload
    const payload = await buildDevolucaoPayload(invoice, body.data.items);
    if (body.data.dryRun) {
      return NextResponse.json({ payload });
    }

    const chave = (body.data.nfeChave ?? "").replace(/\D/g, "") || null;
    const statusNorm = String(body.data.nfeStatus ?? "")
      .toLowerCase()
      .trim();
    const autorizada = statusNorm === "autorizada" && Boolean(chave);

    const byId = new Map(invoice.items.map((i) => [i.id, i]));
    if (autorizada) {
      for (const sel of body.data.items) {
        const row = byId.get(sel.id);
        if (!row?.productId) continue;
        await manualStockOut(
          authz.storeId,
          row.productId,
          sel.quantity,
          `Devolução NF-e entrada ${invoice.number}/${invoice.series}`
        );
      }
    }

    const updated = await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data: {
        returnNfeChave: chave,
        returnNfeStatus: autorizada
          ? "autorizada"
          : body.data.nfeStatus ?? null,
        returnNfeNumero: body.data.nfeNumero ?? null,
        returnNfeAt: autorizada ? new Date() : null,
      },
    });

    return NextResponse.json({ invoice: updated });
  } catch (e) {
    return publicErrorJson(
      "admin:nfe:devolucao:post",
      e,
      "Não foi possível confirmar a devolução."
    );
  }
}
