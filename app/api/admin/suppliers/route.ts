import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireFinanceAuth } from "@/lib/finance-api-auth";
import { publicErrorJson } from "@/lib/public-api-error";

const supplierSchema = z.object({
  name: z.string().trim().min(2),
  tradeName: z.string().optional().nullable(),
  document: z.string().trim().min(11),
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

function digits(doc: string) {
  return doc.replace(/\D/g, "");
}

export async function GET(req: Request) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const suppliers = await prisma.supplier.findMany({
    where: {
      storeId: authz.storeId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { document: { contains: digits(q) } },
              { tradeName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ suppliers });
}

export async function POST(req: Request) {
  const authz = await requireFinanceAuth();
  if ("error" in authz) return authz.error;
  const body = supplierSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  try {
    const document = digits(body.data.document);
    const supplier = await prisma.supplier.create({
      data: {
        storeId: authz.storeId,
        name: body.data.name,
        tradeName: body.data.tradeName || null,
        document,
        ie: body.data.ie || null,
        email: body.data.email || null,
        phone: body.data.phone || null,
        street: body.data.street || null,
        number: body.data.number || null,
        complement: body.data.complement || null,
        district: body.data.district || null,
        city: body.data.city || null,
        state: body.data.state || null,
        zipCode: body.data.zipCode ? digits(body.data.zipCode) : null,
        cityCode: body.data.cityCode || null,
        active: body.data.active ?? true,
      },
    });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (e) {
    return publicErrorJson("admin:suppliers", e, "Não foi possível salvar o fornecedor.");
  }
}
