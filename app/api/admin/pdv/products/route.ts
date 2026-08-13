import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listPdvProducts } from "@/lib/pdv";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? undefined;

  const products = await listPdvProducts(session.user.storeId, q);
  return NextResponse.json({ products });
}
