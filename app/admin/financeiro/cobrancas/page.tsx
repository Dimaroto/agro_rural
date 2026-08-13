import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { getCharges } from "@/lib/finance";
import { FinancePageHeader } from "@/components/admin/finance/FinancePageHeader";
import { FinanceDataTable } from "@/components/admin/finance/FinanceDataTable";
import { FinanceStatusBadge } from "@/components/admin/finance/FinanceStatusBadge";

export default async function CobrancasPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const charges = await getCharges(session.user.storeId);

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Cobranças"
        description="Emissão de cobranças, pagamentos PIX e histórico de transações."
      />

      <FinanceDataTable
        columns={["Pedido", "Cliente", "Valor", "Status pedido", "Pagamento", "Data"]}
        rows={charges.map((c) => [
          `#${c.orderId.slice(0, 8)}`,
          c.customerName ?? "—",
          formatPrice(c.totalCents),
          <FinanceStatusBadge key={`${c.orderId}-o`} status={c.orderStatus} />,
          c.paymentStatus ? (
            <FinanceStatusBadge key={`${c.orderId}-p`} status={c.paymentStatus} />
          ) : (
            "—"
          ),
          c.createdAt.toLocaleDateString("pt-BR"),
        ])}
        emptyMessage="Nenhuma cobrança registrada."
      />
    </div>
  );
}
