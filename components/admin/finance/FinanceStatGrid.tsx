import { DashboardStatCard } from "@/components/admin/DashboardStatCard";

type Stat = {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  variant?: "default" | "emerald";
};

export function FinanceStatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => (
        <DashboardStatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
