import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { cancelExpiredOrders } from "@/lib/orders";
import { OrderCard } from "@/components/admin/OrderCard";
import { OrdersFilterBar } from "@/components/admin/OrdersFilterBar";
import {
  buildAdminOrdersWhere,
  resolveOrderStatusFilter,
} from "@/lib/order-admin";
import {
  ensureStoreOrderNumbers,
  parseOrderCodeQuery,
} from "@/lib/order-number";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const storeId = session.user.storeId;
  const params = await searchParams;
  const statusFilter = resolveOrderStatusFilter(params.status);
  const query = (params.q ?? "").trim();

  await cancelExpiredOrders();
  await ensureStoreOrderNumbers(storeId);

  const orderNumber = parseOrderCodeQuery(query);
  const where = buildAdminOrdersWhere(
    storeId,
    statusFilter,
    query,
    orderNumber
  );

  const [orders, store] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true, payment: true },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    }),
    prisma.store.findUnique({
      where: { id: storeId },
      select: { whatsapp: true },
    }),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-[#026842] dark:text-zinc-100">
        Pedidos
      </h1>
      <p className="mb-4 text-sm text-[#6b7280] dark:text-zinc-400">
        Filtre por status ou digite o número do pedido (ex.: 1 = PD0001).
      </p>

      <Suspense fallback={null}>
        <OrdersFilterBar initialStatus={statusFilter} initialQuery={query} />
      </Suspense>

      {orders.length === 0 ? (
        <p className="text-[#6b7280] dark:text-zinc-400">
          {query || statusFilter !== "all"
            ? "Nenhum pedido encontrado com esses filtros."
            : "Nenhum pedido ainda."}
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              storeWhatsapp={store?.whatsapp ?? null}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
