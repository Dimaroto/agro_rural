import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { getExpenseCategories, getExpenses } from "@/lib/finance";
import { FinancePageHeader } from "@/components/admin/finance/FinancePageHeader";
import { FinanceDataTable } from "@/components/admin/finance/FinanceDataTable";
import { FinanceEntryForm } from "@/components/admin/finance/FinanceEntryForm";
import { DashboardStatCard } from "@/components/admin/DashboardStatCard";

export default async function DespesasPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const [data, categories] = await Promise.all([
    getExpenses(session.user.storeId),
    getExpenseCategories(session.user.storeId),
  ]);

  const total = data.entries.reduce((s, e) => s + e.amountCents, 0);

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Despesas"
        description={`Gastos por categoria. Total: ${formatPrice(total)}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.byCategory
          .filter((g) => g.totalCents > 0)
          .map((g) => (
            <DashboardStatCard
              key={g.category.id}
              label={g.category.name}
              value={formatPrice(g.totalCents)}
            />
          ))}
      </div>

      <FinanceEntryForm type="EXPENSE" categories={categories} />

      <FinanceDataTable
        columns={["Descrição", "Categoria", "Valor", "Data"]}
        rows={data.entries.map((e) => [
          e.description,
          e.category?.name ?? "—",
          formatPrice(e.amountCents),
          e.entryDate.toLocaleDateString("pt-BR"),
        ])}
        emptyMessage="Nenhuma despesa registrada."
      />
    </div>
  );
}
