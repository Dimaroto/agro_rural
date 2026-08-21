import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchFiscalCodes, lookupFiscalCode } from "@/lib/fiscal/tables";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  if (code.trim()) {
    const row = lookupFiscalCode("cfop", code);
    return NextResponse.json({ item: row });
  }

  const items = searchFiscalCodes("cfop", q, limit);
  return NextResponse.json({ items });
}
