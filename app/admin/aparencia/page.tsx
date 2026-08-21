import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ThemeStudio } from "@/components/admin/ThemeStudio";

export default async function AparenciaAdminPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId },
    select: { themeJson: true, bannerUrl: true },
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold dark:text-zinc-100">
        Configurar layout
      </h1>
      <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
        Ajuste cores, banner da home e predefinições do catálogo. A prévia ao
        lado mostra como o visitante vê a página.
      </p>
      <ThemeStudio
        initialTheme={store?.themeJson}
        initialBannerUrl={store?.bannerUrl ?? null}
      />
    </div>
  );
}
