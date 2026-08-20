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
          <div className="admin-nav__inner">
            <AdminNav />
            <div className="admin-nav__actions">
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
