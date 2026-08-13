import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { getExpenseCategories, getPayables, syncPayableStatuses } from "@/lib/finance";
import { FinancePageHeader } from "@/components/admin/finance/FinancePageHeader";
import { FinanceDataTable } from "@/components/admin/finance/FinanceDataTable";
import { FinanceStatusBadge } from "@/components/admin/finance/FinanceStatusBadge";
import { PayableForm, MarkPayablePaidButton } from "@/components/admin/finance/PayableForm";

export default async function ContasAPagarPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  await syncPayableStatuses(session.user.storeId);
  const [payables, categories] = await Promise.all([
    getPayables(session.user.storeId),
    getExpenseCategories(session.user.storeId),
  ]);

  const pending = payables.filter((p) => p.status === "PENDING" || p.status === "OVERDUE");
  const totalPending = pending.reduce((s, p) => s + p.amountCents, 0);

  return (
    <div className="space-y-6">
      <FinancePageHeader
        title="Contas a pagar"
        description={`Boletos, fornecedores e despesas futuras. Pendente: ${formatPrice(totalPending)}`}
      />

      <PayableForm categories={categories} />

      <FinanceDataTable
        columns={["Título", "Categoria", "Valor", "Vencimento", "Status", "Ações"]}
        rows={payables.map((p) => [
          p.title,
          p.category?.name ?? "—",
          formatPrice(p.amountCents),
          p.dueDate.toLocaleDateString("pt-BR"),
          <FinanceStatusBadge key={`${p.id}-st`} status={p.status} />,
          p.status !== "PAID" ? (
            <MarkPayablePaidButton key={`${p.id}-btn`} id={p.id} />
          ) : (
            "—"
          ),
        ])}
        emptyMessage="Nenhuma conta a pagar cadastrada."
      />
    </div>
  );
}
