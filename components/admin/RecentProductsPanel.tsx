import Image from "next/image";
import Link from "next/link";
import type { DashboardRecentProduct } from "@/lib/admin-dashboard";
import { PackageIcon } from "@/components/icons/UiIcons";

function formatUpdatedAt(date: Date): string {
  const now = new Date();
  const updated = new Date(date);
  const diffMs = now.getTime() - updated.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours} h`;
  if (diffDays === 1) return "ontem";
  return updated.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type RecentProductsPanelProps = {
  products: DashboardRecentProduct[];
};

export function RecentProductsPanel({ products }: RecentProductsPanelProps) {
  return (
    <section className="admin-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-[#2D4C1E] dark:text-zinc-100">
          Últimos produtos editados
        </h2>
        <Link
          href="/admin/produtos"
          className="text-sm text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Ver todos
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-[#6b7280] dark:text-zinc-400">
          Nenhum produto cadastrado ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={`/admin/produtos/${product.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[#eaf8f2] dark:hover:bg-zinc-800/60"
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-[#E4EAD8] dark:bg-zinc-800">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-300">
                      <PackageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#2D4C1E] dark:text-zinc-100">
                    {product.name}
                  </p>
                  <p className="text-xs text-[#6b7280] dark:text-zinc-400">
                    Editado {formatUpdatedAt(product.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
