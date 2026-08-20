import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceiroBedendoClient } from "@/components/admin/FinanceiroBedendoClient";

export default async function AdminFinanceiroPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");
  return <FinanceiroBedendoClient />;
}
