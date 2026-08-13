import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  whatsapp: z.string().optional(),
  bannerUrl: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId },
    select: {
      id: true,
      name: true,
      slug: true,
      whatsapp: true,
      bannerUrl: true,
    },
  });

  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  return NextResponse.json(store);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const data: {
    whatsapp?: string | null;
    bannerUrl?: string | null;
  } = {};

  if (body.data.whatsapp !== undefined) {
    const digits = body.data.whatsapp.replace(/\D/g, "");
    if (digits && (digits.length < 10 || digits.length > 15)) {
      return NextResponse.json(
        {
          error:
            "Número inválido. Use DDI + DDD + número (ex: 554984376190).",
        },
        { status: 400 }
      );
    }
    data.whatsapp = digits || null;
  }

  if (body.data.bannerUrl !== undefined) {
    const url = body.data.bannerUrl?.trim() || null;
    data.bannerUrl = url;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const store = await prisma.store.update({
    where: { id: session.user.storeId },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      whatsapp: true,
      bannerUrl: true,
    },
  });

  return NextResponse.json(store);
}
