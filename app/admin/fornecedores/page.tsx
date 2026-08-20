import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServerAgroAppClient } from "@/lib/admin-app-client-server";
import { SuppliersPageClient } from "@/components/admin/SuppliersPageClient";

export default async function AdminFornecedoresPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");
  const app = await getServerAgroAppClient();
  if (!app) redirect("/admin");
  return <SuppliersPageClient />;
}
