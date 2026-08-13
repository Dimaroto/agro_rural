import { NextResponse } from "next/server";
import { getDefaultStore, getProductById } from "@/lib/store";

type RouteContext = { params: Promise<{ id: string }> };

/** Detalhe completo do produto (campos de personalização) para o modal. */
export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Produto inválido" }, { status: 400 });
  }

  const store = await getDefaultStore();
  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  const product = await getProductById(store.id, id);
  if (!product) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  return NextResponse.json(
    { product },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    }
  );
}
