import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceSubNav } from "@/components/admin/FinanceSubNav";

export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  return (
    <div className="admin-finance-layout">
      <FinanceSubNav />
      <div className="admin-finance-layout__content">{children}</div>
    </div>
  );
}
