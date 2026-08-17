import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ThemeStudio } from "@/components/admin/ThemeStudio";

export default async function CoresAdminPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId },
    select: { themeJson: true },
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold dark:text-zinc-100">
        Configurar cores
      </h1>
      <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
        Monte o cabeçalho, os botões e o fundo do catálogo. Salve como
        predefinição para trocar o visual depois sem perder o que já ficou
        pronto.
      </p>
      <ThemeStudio initialTheme={store?.themeJson} />
    </div>
  );
}
