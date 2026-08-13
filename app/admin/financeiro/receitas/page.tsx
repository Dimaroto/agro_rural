import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { getRevenues } from "@/lib/finance";
import { FinancePageHeader } from "@/components/admin/finance/FinancePageHeader";
import { FinanceDataTable } from "@/components/admin/finance/FinanceDataTable";
import { FinanceEntryForm } from "@/components/admin/finance/FinanceEntryForm";

export default async function ReceitasPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const revenues = await getRevenues(session.user.storeId);
  const total = revenues.reduce((s, r) => s + r.amountCents, 0);

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Receitas"
        description={`Todas as entradas de dinheiro e vendas realizadas. Total: ${formatPrice(total)}`}
      />

      <FinanceEntryForm type="INCOME" />

      <FinanceDataTable
        columns={["Descrição", "Origem", "Valor", "Data"]}
        rows={revenues.map((r) => [
          r.description,
          r.source === "ORDER" ? "Venda" : "Manual",
          formatPrice(r.amountCents),
          r.date.toLocaleDateString("pt-BR"),
        ])}
        emptyMessage="Nenhuma receita encontrada."
      />
    </div>
  );
}
