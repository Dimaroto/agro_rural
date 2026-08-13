import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { getFinanceDashboard } from "@/lib/finance";
import { FinancePageHeader } from "@/components/admin/finance/FinancePageHeader";
import { FinanceStatGrid } from "@/components/admin/finance/FinanceStatGrid";
import { FinanceBarChart } from "@/components/admin/finance/FinanceBarChart";
import { FinanceDataTable } from "@/components/admin/finance/FinanceDataTable";

export default async function FinanceDashboardPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const data = await getFinanceDashboard(session.user.storeId);

  return (
    <div className="space-y-8">
      <FinancePageHeader
        title="Dashboard financeiro"
        description="Visão geral de saldo, receitas, despesas e indicadores principais."
      />

      <FinanceStatGrid
        stats={[
          {
            label: "Saldo atual",
            value: formatPrice(data.balanceCents),
            variant: "emerald",
            href: "/admin/financeiro/fluxo-de-caixa",
          },
          {
            label: "Receita do mês",
            value: formatPrice(data.monthRevenueCents),
            href: "/admin/financeiro/receitas",
          },
          {
            label: "Despesas do mês",
            value: formatPrice(data.monthExpensesCents),
            href: "/admin/financeiro/despesas",
          },
          {
            label: "Lucro do mês",
            value: formatPrice(data.monthProfitCents),
            hint: data.monthProfitCents >= 0 ? "Positivo" : "Negativo",
          },
          {
            label: "A receber",
            value: formatPrice(data.pendingReceivablesCents),
            href: "/admin/financeiro/contas-a-receber",
          },
          {
            label: "A pagar",
            value: formatPrice(data.pendingPayablesCents),
            hint:
              data.overduePayablesCount > 0
                ? `${data.overduePayablesCount} vencida(s)`
                : undefined,
            href: "/admin/financeiro/contas-a-pagar",
          },
        ]}
      />

      <section>
        <h2 className="admin-section-title">Fluxo de caixa — últimos 6 meses</h2>
        <FinanceBarChart items={data.cashFlowMonths} mode="both" />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="admin-section-title mb-0">Receitas recentes</h2>
            <Link href="/admin/financeiro/receitas" className="text-sm text-emerald-700">
              Ver todas
            </Link>
          </div>
          <FinanceDataTable
            columns={["Descrição", "Valor", "Data"]}
            rows={data.recentRevenues.map((r) => [
              r.description,
              formatPrice(r.amountCents),
              r.date.toLocaleDateString("pt-BR"),
            ])}
            emptyMessage="Nenhuma receita registrada."
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="admin-section-title mb-0">Despesas recentes</h2>
            <Link href="/admin/financeiro/despesas" className="text-sm text-emerald-700">
              Ver todas
            </Link>
          </div>
          <FinanceDataTable
            columns={["Descrição", "Valor", "Data"]}
            rows={data.recentExpenses.map((e) => [
              e.category ? `${e.description} (${e.category})` : e.description,
              formatPrice(e.amountCents),
              e.date.toLocaleDateString("pt-BR"),
            ])}
            emptyMessage="Nenhuma despesa registrada."
          />
        </section>
      </div>
    </div>
  );
}
