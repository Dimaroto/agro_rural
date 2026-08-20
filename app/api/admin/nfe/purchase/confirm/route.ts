import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import { parsePurchaseXml } from "@/lib/nfe/purchase-xml-parser";
import { confirmPurchaseImport } from "@/lib/nfe/purchase-import-service";
import { publicErrorJson } from "@/lib/public-api-error";

const schema = z.object({
  xml: z.string().min(20),
  categoryLabel: z.string().optional(),
  itemOverrides: z
    .array(
      z.object({
        index: z.number().int().min(0),
        priceCents: z.number().int().min(0),
        productId: z.string().nullable().optional(),
        skipStock: z.boolean().optional(),
      })
    )
    .optional(),
  chargeDueDates: z.record(z.string(), z.string().nullable()).optional(),
});

export async function POST(req: Request) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  try {
    const body = schema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
    }
    const parsed = parsePurchaseXml(body.data.xml);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }
    const result = await confirmPurchaseImport(authz.storeId, parsed.nota, {
      categoryLabel: body.data.categoryLabel,
      itemOverrides: body.data.itemOverrides,
      chargeDueDates: body.data.chargeDueDates,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }
    return NextResponse.json({ result });
  } catch (e) {
    return publicErrorJson("admin:nfe:confirm", e, "Falha ao importar a NF-e.");
  }
}
