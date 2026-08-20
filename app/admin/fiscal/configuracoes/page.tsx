import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServerAgroAppClient } from "@/lib/admin-app-client-server";
import { FiscalConfigPageClient } from "@/components/admin/FiscalConfigPageClient";

export default async function AdminFiscalConfigPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");
  const app = await getServerAgroAppClient();
  if (!app) redirect("/admin");

  return <FiscalConfigPageClient />;
}
