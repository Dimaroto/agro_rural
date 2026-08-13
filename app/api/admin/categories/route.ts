import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/format";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    where: { storeId: session.user.storeId },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          products: true,
          productLinks: true,
        },
      },
    },
  });

  return NextResponse.json(
    categories.map((category) => ({
      ...category,
      _count: {
        products: Math.max(category._count.products, category._count.productLinks),
      },
    }))
  );
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

  const slug = slugify(body.data.name);
  const category = await prisma.category.create({
    data: {
      storeId: session.user.storeId,
      name: body.data.name,
      slug,
      sortOrder: body.data.sortOrder ?? 0,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
