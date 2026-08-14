import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAdminCustomers } from "@/lib/admin-customers";
import { CustomersPageClient } from "@/components/admin/CustomersPageClient";

export default async function AdminCustomersPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const customers = await listAdminCustomers(session.user.storeId);

  return (
    <CustomersPageClient
      initialCustomers={customers.map((c) => ({
        ...c,
        lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : null,
      }))}
    />
  );
}
