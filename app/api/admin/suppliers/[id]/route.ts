import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import { publicErrorJson } from "@/lib/public-api-error";

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  tradeName: z.string().optional().nullable(),
  document: z.string().trim().min(11).optional(),
  ie: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  cityCode: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const supplier = await prisma.supplier.findFirst({
    where: { id, storeId: authz.storeId },
  });
  if (!supplier) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ supplier });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const existing = await prisma.supplier.findFirst({
    where: { id, storeId: authz.storeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  try {
    const data = { ...body.data } as Record<string, unknown>;
    if (typeof data.document === "string") {
      data.document = data.document.replace(/\D/g, "");
    }
    if (typeof data.zipCode === "string") {
      data.zipCode = data.zipCode.replace(/\D/g, "");
    }
    const supplier = await prisma.supplier.update({
      where: { id },
      data,
    });
    return NextResponse.json({ supplier });
  } catch (e) {
    return publicErrorJson("admin:suppliers:id", e, "Não foi possível atualizar o fornecedor.");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const { id } = await params;
  const existing = await prisma.supplier.findFirst({
    where: { id, storeId: authz.storeId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  await prisma.supplier.update({
    where: { id },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
