import { NextResponse } from "next/server";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import { getExpenseCategories } from "@/lib/finance";

export async function GET() {
  const authResult = await requireFinanceAuth();
  if ("error" in authResult) return authResult.error;

  const categories = await getExpenseCategories(authResult.storeId);
  return NextResponse.json(categories);
}
