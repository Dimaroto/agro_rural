import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NotificationSettingsForm } from "@/components/admin/NotificationSettingsForm";

export default async function NotificationsSettingsPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold dark:text-zinc-100">
        Configurar notificações
      </h1>
      <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
        Escolha quais eventos enviam alertas para este aparelho. As preferências
        são salvas no navegador e sincronizadas com o push do dispositivo.
      </p>
      <NotificationSettingsForm />
    </div>
  );
}
