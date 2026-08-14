import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/order-admin-shared";
import { formatOrderCode } from "@/lib/order-number";
import type { DashboardRecentOrder } from "@/lib/admin-dashboard";

function formatOrderDate(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfOrder = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfOrder.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type RecentOrdersPanelProps = {
  orders: DashboardRecentOrder[];
};

export function RecentOrdersPanel({ orders }: RecentOrdersPanelProps) {
  return (
    <section className="admin-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-[#026842] dark:text-zinc-100">
          Vendas recentes
        </h2>
        <Link
          href="/admin/pedidos"
          className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Ver todos
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma venda ainda.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/admin/pedidos#order-${order.id}`}
                className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatOrderCode(order.orderNumber, order.id)}
                    {order.customerName ? ` · ${order.customerName}` : ""}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {ORDER_STATUS_LABELS[order.status]} ·{" "}
                    {formatOrderDate(order.createdAt)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatPrice(order.totalCents)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
