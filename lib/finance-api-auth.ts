import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function requireFinanceAuth() {
  const session = await auth();
  if (!session?.user?.storeId) {
    return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) };
  }
  return { storeId: session.user.storeId };
}

/** Garante que a categoria financeira pertence à loja (anti cross-tenant). */
export async function resolveFinanceCategoryId(
  storeId: string,
  categoryId: string | null | undefined
): Promise<
  | { categoryId: string | null }
  | { error: NextResponse }
> {
  if (categoryId == null || categoryId === "") {
    return { categoryId: null };
  }

  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, storeId },
    select: { id: true },
  });

  if (!category) {
    return {
      error: NextResponse.json(
        { error: "Categoria inválida para esta loja." },
        { status: 400 }
      ),
    };
  }

  return { categoryId: category.id };
}
