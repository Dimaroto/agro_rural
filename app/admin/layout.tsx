import { auth } from "@/lib/auth";
import { signOut } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { SettingsBar } from "@/components/admin/SettingsBar";
import { AdminDeviceNotifications } from "@/components/admin/AdminDeviceNotifications";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { UnsavedChangesProvider } from "@/components/admin/UnsavedChangesContext";
import { prisma } from "@/lib/db";
import { getServerAgroAppClient } from "@/lib/admin-app-client-server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isLogin = false;

  if (!session?.user && !isLogin) {
    return <>{children}</>;
  }

  if (!session?.user) {
    return <>{children}</>;
  }

  const appClient = await getServerAgroAppClient();
  const showAppChrome = Boolean(appClient);

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId },
    select: { whatsapp: true, bannerUrl: true },
  });

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <UnsavedChangesProvider>
      <div className="admin-shell">
        <header className="admin-nav">
          <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4 lg:h-14">
            <AdminNav />
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {showAppChrome && (
                <SettingsBar
                  initialWhatsapp={store?.whatsapp}
                  initialBannerUrl={store?.bannerUrl}
                />
              )}
              <AdminSignOutButton signOutAction={signOutAction} />
            </div>
          </div>
        </header>
        {showAppChrome && <AdminDeviceNotifications />}
        <main className="admin-main">{children}</main>
      </div>
    </UnsavedChangesProvider>
  );
}
