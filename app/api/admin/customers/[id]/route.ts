import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getAdminCustomer,
  updateAdminCustomer,
} from "@/lib/admin-customers";
import { publicErrorJson } from "@/lib/public-api-error";
import { decryptCustomerPii } from "@/lib/customer-field-crypto";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const customer = await getAdminCustomer(session.user.storeId, id);
  if (!customer) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ customer });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = updateSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  try {
    const updated = await updateAdminCustomer(session.user.storeId, id, {
      name: body.data.name,
      phone: body.data.phone,
      email: body.data.email,
    });
    const pii = decryptCustomerPii(updated);
    return NextResponse.json({
      customer: {
        id: updated.id,
        name: pii.name,
        phone: pii.phone,
        email: updated.email,
      },
    });
  } catch (e) {
    return publicErrorJson(
      "admin:customers:update",
      e,
      e instanceof Error ? e.message : "Não foi possível atualizar o cliente."
    );
  }
}
