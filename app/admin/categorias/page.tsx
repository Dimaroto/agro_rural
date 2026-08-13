import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CategoryManager } from "@/components/admin/CategoryManager";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

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

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold dark:text-zinc-100">Categorias</h1>
      <CategoryManager
        initial={categories.map((category) => ({
          ...category,
          showOnHome: category.showOnHome ?? true,
          _count: {
            products: Math.max(
              category._count.products,
              category._count.productLinks
            ),
          },
        }))}
      />
    </div>
  );
}
