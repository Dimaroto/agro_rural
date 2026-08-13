import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { getCashFlow } from "@/lib/finance";
import { FinancePageHeader } from "@/components/admin/finance/FinancePageHeader";
import { FinanceDataTable } from "@/components/admin/finance/FinanceDataTable";
import { FinanceBarChart } from "@/components/admin/finance/FinanceBarChart";
import { FinanceStatGrid } from "@/components/admin/finance/FinanceStatGrid";

export default async function FluxoDeCaixaPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const data = await getCashFlow(session.user.storeId);

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Fluxo de caixa"
        description="Entradas, saídas e saldo projetado ao longo do tempo."
      />

      <FinanceStatGrid
        stats={[
          {
            label: "Saldo projetado",
            value: formatPrice(data.projectedBalanceCents),
            variant: "emerald",
          },
          {
            label: "Pendente a receber",
            value: formatPrice(data.pendingReceivablesCents),
          },
          {
            label: "Pendente a pagar",
            value: formatPrice(data.pendingPayablesCents),
          },
        ]}
      />

      <FinanceBarChart
        items={data.months.map((m) => ({
          label: m.label,
          incomeCents: m.incomeCents,
          expenseCents: m.expenseCents,
        }))}
        mode="both"
      />

      <FinanceDataTable
        columns={["Mês", "Entradas", "Saídas", "Resultado", "Acumulado"]}
        rows={data.months.map((m) => [
          m.label,
          formatPrice(m.incomeCents),
          formatPrice(m.expenseCents),
          formatPrice(m.balanceCents),
          formatPrice(m.cumulativeCents),
        ])}
      />
    </div>
  );
}
