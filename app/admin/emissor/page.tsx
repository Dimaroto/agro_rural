import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

/** Configuração fiscal/A1 fica no emissor local (Abrir emissor). */
export default async function EmissorAdminPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");
  redirect("/admin/fiscal");
}
