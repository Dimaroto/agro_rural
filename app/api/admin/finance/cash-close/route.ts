import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import {
  closeCashDay,
  reopenCashDay,
  todayIsoDay,
} from "@/lib/finance-ledger";
import { publicErrorJson } from "@/lib/public-api-error";

const schema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  action: z.enum(["close", "reopen"]),
  notes: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const session = await auth();
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const day = body.data.day ?? todayIsoDay();
  try {
    if (body.data.action === "close") {
      const cashClose = await closeCashDay(
        authz.storeId,
        day,
        session?.user?.id,
        body.data.notes
      );
      return NextResponse.json({ cashClose });
    }
    await reopenCashDay(authz.storeId, day);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return publicErrorJson("admin:finance:cash-close", e, "Não foi possível alterar o caixa.");
  }
}
