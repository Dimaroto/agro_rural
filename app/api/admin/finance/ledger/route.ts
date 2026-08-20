import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import {
  assertCashOpen,
  createLedgerEntry,
  ensureDefaultFinanceCategories,
  listDayLedger,
  listPendingLedger,
  todayIsoDay,
} from "@/lib/finance-ledger";
import { publicErrorJson } from "@/lib/public-api-error";

const createSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  status: z.enum(["PENDING", "CONFIRMED"]).optional(),
  description: z.string().trim().min(2),
  amountCents: z.number().int().positive(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  categoryLabel: z.string().nullable().optional(),
  paymentMethod: z.string().optional(),
  customerId: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  supplierName: z.string().nullable().optional(),
  boletoCode: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "day";
  await ensureDefaultFinanceCategories(authz.storeId);
  if (view === "pending") {
    const pending = await listPendingLedger(authz.storeId);
    return NextResponse.json(pending);
  }
  const day = url.searchParams.get("day") ?? todayIsoDay();
  const summary = await listDayLedger(authz.storeId, day);
  return NextResponse.json(summary);
}

export async function POST(req: Request) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  try {
    const status = body.data.status ?? "CONFIRMED";
    const day = body.data.entryDate ?? todayIsoDay();
    if (status === "CONFIRMED") {
      await assertCashOpen(authz.storeId, day);
    }
    const entry = await createLedgerEntry(authz.storeId, {
      ...body.data,
      status,
      entryDate: day,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    return publicErrorJson("admin:finance:ledger", e, "Não foi possível criar o lançamento.");
  }
}
