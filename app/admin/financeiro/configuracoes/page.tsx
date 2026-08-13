import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getExpenseCategories,
  getFinancialSettings,
} from "@/lib/finance";
import { FinancePageHeader } from "@/components/admin/finance/FinancePageHeader";
import { FinancialSettingsForm } from "@/components/admin/finance/FinancialSettingsForm";

export default async function ConfiguracoesFinanceirasPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const [settings, categories] = await Promise.all([
    getFinancialSettings(session.user.storeId),
    getExpenseCategories(session.user.storeId),
  ]);

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Configurações financeiras"
        description="Saldo inicial, moeda padrão e categorias de despesa."
      />

      <FinancialSettingsForm
        openingBalanceCents={settings.openingBalanceCents}
        defaultCurrency={settings.defaultCurrency}
        notes={settings.notes}
      />

      <div className="finance-form-card">
        <h3 className="mb-3 text-sm font-semibold text-[#026842] dark:text-zinc-100">
          Categorias de despesa
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-[#b8e5d4]/80 px-3 py-2 text-sm text-[#026842] dark:border-zinc-800 dark:text-zinc-200"
            >
              {c.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
