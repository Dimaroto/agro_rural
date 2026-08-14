import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { getFinanceCustomers } from "@/lib/finance";
import { FinancePageHeader } from "@/components/admin/finance/FinancePageHeader";
import { FinanceDataTable } from "@/components/admin/finance/FinanceDataTable";

export default async function FinanceClientesPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const customers = await getFinanceCustomers(session.user.storeId);

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Clientes"
        description="Histórico financeiro individual de cada cliente com pedidos na loja."
      />

      <FinanceDataTable
        columns={[
          "Nome",
          "E-mail",
          "Total gasto",
          "Vendas pagas",
          "Pendentes",
          "Última venda",
        ]}
        rows={customers.map((c) => [
          c.name ?? "—",
          c.email,
          formatPrice(c.totalSpentCents),
          String(c.paidOrderCount),
          String(c.pendingOrderCount),
          c.lastOrderAt ? c.lastOrderAt.toLocaleDateString("pt-BR") : "—",
        ])}
        emptyMessage="Nenhum cliente com pedidos registrados."
      />
    </div>
  );
}
