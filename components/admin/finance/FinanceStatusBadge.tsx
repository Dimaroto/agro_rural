export function FinanceStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  let className = "finance-badge finance-badge--pending";
  let label = status;

  if (["PAID", "APPROVED", "DELIVERED"].includes(normalized)) {
    className = "finance-badge finance-badge--paid";
    label = normalized === "APPROVED" ? "Aprovado" : normalized === "PAID" ? "Pago" : status;
  } else if (["OVERDUE", "REJECTED", "EXPIRED"].includes(normalized)) {
    className = "finance-badge finance-badge--overdue";
    label =
      normalized === "OVERDUE"
        ? "Vencido"
        : normalized === "REJECTED"
          ? "Rejeitado"
          : "Expirado";
  } else if (normalized === "PENDING" || normalized === "AWAITING_PIX") {
    label = normalized === "AWAITING_PIX" ? "Aguardando PIX" : "Pendente";
  }

  return <span className={className}>{label}</span>;
}
