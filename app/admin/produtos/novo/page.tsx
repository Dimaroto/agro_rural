import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/ProductForm";

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const categories = await prisma.category.findMany({
    where: { storeId: session.user.storeId, active: true },
    orderBy: { sortOrder: "asc" },
  });

  if (categories.length === 0) {
    return (
      <div className="admin-card p-8 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          Crie pelo menos uma categoria antes de adicionar produtos.
        </p>
        <Link
          href="/admin/categorias"
          className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          Ir para categorias
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/produtos"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Voltar para produtos
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">Novo produto</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Preencha os dados para adicionar ao catálogo
        </p>
      </header>
      <ProductForm categories={categories} />
    </div>
  );
}
