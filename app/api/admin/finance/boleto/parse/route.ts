import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import { parseBoleto } from "@/lib/nfe/boleto-parser";

const schema = z.object({
  code: z.string().min(44),
});

export async function POST(req: Request) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }
  return NextResponse.json({ result: parseBoleto(body.data.code) });
}
