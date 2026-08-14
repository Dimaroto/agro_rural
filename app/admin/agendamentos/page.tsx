import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAdminAppointments } from "@/lib/admin-appointments";
import { AppointmentsPageClient } from "@/components/admin/AppointmentsPageClient";

export default async function AdminAppointmentsPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const appointments = await listAdminAppointments(
    session.user.storeId,
    "today"
  );

  return <AppointmentsPageClient initialAppointments={appointments} />;
}
