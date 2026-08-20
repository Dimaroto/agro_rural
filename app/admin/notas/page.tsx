import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getServerAgroAppClient } from "@/lib/admin-app-client-server";
import { NotasFiscaisPageClient } from "@/components/admin/NotasFiscaisPageClient";

export default async function AdminNotasPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");
  const app = await getServerAgroAppClient();
  if (!app) redirect("/admin");
  return <NotasFiscaisPageClient />;
}
