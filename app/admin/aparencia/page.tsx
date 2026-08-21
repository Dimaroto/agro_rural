import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ensureStoreBannerMobileColumn } from "@/lib/ensure-store-banner-mobile";
import { ThemeStudio } from "@/components/admin/ThemeStudio";

export default async function AparenciaAdminPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  await ensureStoreBannerMobileColumn();

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId },
    select: { themeJson: true, bannerUrl: true, bannerUrlMobile: true },
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold dark:text-zinc-100">
        Configurar layout
      </h1>
      <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
        Cores, banners (computador 3:1 e celular 16:9) e predefinições. Use a
        prévia para alternar entre Computador e Celular.
      </p>
      <ThemeStudio
        initialTheme={store?.themeJson}
        initialBannerUrl={store?.bannerUrl ?? null}
        initialBannerUrlMobile={store?.bannerUrlMobile ?? null}
      />
    </div>
  );
}
