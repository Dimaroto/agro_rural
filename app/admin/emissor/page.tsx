import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EmissorLocalClient } from "@/components/admin/EmissorLocalClient";
import { getEmissorSetupDownloadUrl } from "@/lib/nfe/setup-url";

export default async function EmissorAdminPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold dark:text-zinc-100">Emissor NF-e</h1>
      <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
        Baixe o programa no Windows desta loja, inicie o emissor local e envie o
        certificado A1. Nada disso roda na nuvem.
      </p>
      <EmissorLocalClient setupDownloadUrl={getEmissorSetupDownloadUrl()} />
    </div>
  );
}
