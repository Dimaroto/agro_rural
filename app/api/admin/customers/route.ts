import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createAdminCustomer,
  listAdminCustomers,
} from "@/lib/admin-customers";
import { publicErrorJson } from "@/lib/public-api-error";
import { decryptCustomerPii } from "@/lib/customer-field-crypto";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  const customers = await listAdminCustomers(session.user.storeId, q);
  return NextResponse.json({ customers });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  try {
    const created = await createAdminCustomer(session.user.storeId, {
      name: body.data.name,
      phone: body.data.phone,
      email: body.data.email,
    });
    const pii = decryptCustomerPii(created);
    return NextResponse.json(
      {
        customer: {
          id: created.id,
          name: pii.name,
          phone: pii.phone,
          email: created.email,
          openBalanceCents: 0,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return publicErrorJson(
      "admin:customers:create",
      e,
      e instanceof Error ? e.message : "Não foi possível salvar o cliente."
    );
  }
}
