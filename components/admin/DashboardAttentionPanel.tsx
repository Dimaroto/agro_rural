import Link from "next/link";
import type { DashboardAttentionItem } from "@/lib/admin-dashboard";

type DashboardAttentionPanelProps = {
  items: DashboardAttentionItem[];
};

export function DashboardAttentionPanel({ items }: DashboardAttentionPanelProps) {
  if (items.length === 0) return null;

  return (
    <section
      role="status"
      className="admin-card border-amber-200/90 bg-[#f4fbf7] p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
    >
      <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        Precisa de atenção
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-start gap-2 text-sm text-amber-900/90 transition hover:text-emerald-700 dark:text-amber-100 dark:hover:text-emerald-400"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>{item.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
