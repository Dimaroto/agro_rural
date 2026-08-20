import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import { parsePurchaseXml } from "@/lib/nfe/purchase-xml-parser";
import { previewPurchaseImport } from "@/lib/nfe/purchase-import-service";
import { publicErrorJson } from "@/lib/public-api-error";

const schema = z.object({
  xml: z.string().min(20).optional(),
});

export async function POST(req: Request) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success || !body.data.xml) {
      return NextResponse.json(
        { error: "Informe o XML da NF-e." },
        { status: 400 }
      );
    }
    const parsed = parsePurchaseXml(body.data.xml);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }
    const preview = await previewPurchaseImport(authz.storeId, parsed.nota);
    return NextResponse.json({ preview });
  } catch (e) {
    return publicErrorJson("admin:nfe:preview", e, "Falha no preview da NF-e.");
  }
}
