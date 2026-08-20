import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServerAgroAppClient } from "@/lib/admin-app-client-server";
import { FiscalPageClient } from "@/components/admin/FiscalPageClient";

export default async function AdminFiscalPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");
  const app = await getServerAgroAppClient();
  if (!app) redirect("/admin");

  return <FiscalPageClient />;
}
