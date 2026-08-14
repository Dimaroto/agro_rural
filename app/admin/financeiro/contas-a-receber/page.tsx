import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { getReceivables } from "@/lib/finance";
import { FinancePageHeader } from "@/components/admin/finance/FinancePageHeader";
import { FinanceDataTable } from "@/components/admin/finance/FinanceDataTable";
import { FinanceStatusBadge } from "@/components/admin/finance/FinanceStatusBadge";

export default async function ContasAReceberPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const receivables = await getReceivables(session.user.storeId);
  const total = receivables.reduce((s, o) => s + o.totalCents, 0);

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Contas a receber"
        description={`Pagamentos pendentes e vendas aguardando confirmação. Total: ${formatPrice(total)}`}
      />

      <FinanceDataTable
        columns={["Pedido", "Cliente", "Valor", "Vencimento", "Status"]}
        rows={receivables.map((o) => [
          <Link key={o.id} href="/admin/pedidos" className="text-emerald-700 hover:underline">
            #{o.id.slice(0, 8)}
          </Link>,
          o.customerName ?? "—",
          formatPrice(o.totalCents),
          (o.receivableDueAt ?? o.pixExpiresAt)
            ? (o.receivableDueAt ?? o.pixExpiresAt)!.toLocaleString("pt-BR")
            : "—",
          <FinanceStatusBadge key={`${o.id}-st`} status={o.status} />,
        ])}
        emptyMessage="Nenhuma conta a receber no momento."
      />
    </div>
  );
}
