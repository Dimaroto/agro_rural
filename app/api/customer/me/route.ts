import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-session";

export async function GET() {
  const customer = await getCustomerSession();
  if (!customer) {
    return NextResponse.json({ customer: null }, { status: 401 });
  }
  return NextResponse.json({ customer });
}
