import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { getDashboardStats } from "@/lib/admin-dashboard";
import { DashboardStatCard } from "@/components/admin/DashboardStatCard";
import { DashboardAttentionPanel } from "@/components/admin/DashboardAttentionPanel";
import { RecentOrdersPanel } from "@/components/admin/RecentOrdersPanel";
import { RecentProductsPanel } from "@/components/admin/RecentProductsPanel";
import { CatalogLinkCard } from "@/components/admin/CatalogLinkCard";
import { WhatsAppStatusCard } from "@/components/admin/WhatsAppStatusCard";
import {
  LowStockIcon,
  OrdersIcon,
  OutOfStockIcon,
  PixIcon,
  ProductsIcon,
  SalesIcon,
  TicketIcon,
  TopProductIcon,
} from "@/components/admin/AdminIcons";

function currentMonthLabel(): string {
  return new Date().toLocaleDateString("pt-BR", { month: "long" });
}

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  const storeId = session.user.storeId;

  const [store, stats] = await Promise.all([
    prisma.store.findUnique({ where: { id: storeId } }),
    getDashboardStats(storeId),
  ]);

  const catalogUrl = config.appUrl;
  const monthLabel = currentMonthLabel();

  const topProductValue = stats.topProduct
    ? stats.topProduct.name
    : "Nenhuma venda ainda";
  const topProductHint = stats.topProduct
    ? `${stats.topProduct.quantity} un. vendidas`
    : undefined;

  const ticketValue =
    stats.averageTicketCents !== null
      ? formatPrice(stats.averageTicketCents)
      : "—";

  const pendingPixHint = config.paymentsEnabled
    ? "PIX habilitado"
    : "PIX desabilitado";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#026842] dark:text-zinc-100">
            {store?.name ?? "SaboArt"}
          </h1>
          <p className="mt-1 text-sm text-[#6b7280] dark:text-zinc-400">
            Visão geral
          </p>
        </div>
        <Link href="/admin/produtos/novo" className="admin-btn-primary">
          <span className="text-lg leading-none">+</span>
          Novo produto
        </Link>
      </header>

      <DashboardAttentionPanel items={stats.attentionItems} />

      <section>
        <h2 className="admin-section-title">Vendas</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStatCard
            label="Vendas totais"
            value={formatPrice(stats.totalSalesCents)}
            hint={`${formatPrice(stats.monthSalesCents)} em ${monthLabel}`}
            variant="emerald"
            icon={<SalesIcon className="h-5 w-5" />}
          />
          <DashboardStatCard
            label="Vendas pagas"
            value={String(stats.paidOrderCount)}
            href="/admin/pedidos"
            icon={<OrdersIcon className="h-5 w-5" />}
          />
          <DashboardStatCard
            label="Ticket médio"
            value={ticketValue}
            icon={<TicketIcon className="h-5 w-5" />}
          />
          <DashboardStatCard
            label="Produto mais vendido"
            value={topProductValue}
            hint={topProductHint}
            icon={<TopProductIcon className="h-5 w-5" />}
          />
        </div>
      </section>

      <section>
        <h2 className="admin-section-title">Operação</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStatCard
            label="Produtos ativos"
            value={String(stats.activeProductCount)}
            href="/admin/produtos"
            icon={<ProductsIcon className="h-5 w-5" />}
          />
          <DashboardStatCard
            label="Estoque baixo"
            value={String(stats.lowStockCount)}
            href="/admin/produtos"
            icon={<LowStockIcon className="h-5 w-5" />}
          />
          <DashboardStatCard
            label="Aguardando PIX"
            value={String(stats.pendingPixCount)}
            hint={pendingPixHint}
            href="/admin/pedidos"
            icon={<PixIcon className="h-5 w-5" />}
          />
          <DashboardStatCard
            label="Sem estoque"
            value={String(stats.outOfStockCount)}
            href="/admin/produtos"
            icon={<OutOfStockIcon className="h-5 w-5" />}
          />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <RecentOrdersPanel orders={stats.recentOrders} />
          <RecentProductsPanel products={stats.recentProducts} />
        </div>

        <section className="flex flex-col gap-4">
          <CatalogLinkCard
            catalogUrl={catalogUrl}
            storeName={store?.name}
          />
          <WhatsAppStatusCard whatsapp={store?.whatsapp ?? null} />

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/produtos" className="admin-btn-primary">
              Gerenciar produtos
            </Link>
            <Link href="/admin/categorias" className="admin-btn-secondary">
              Categorias
            </Link>
            <Link
              href="/"
              target="_blank"
              className="admin-btn-secondary"
            >
              Ver catálogo público
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
