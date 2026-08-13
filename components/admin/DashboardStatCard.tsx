import Link from "next/link";
import type { ReactNode } from "react";

type DashboardStatCardProps = {
  label: string;
  value: string;
  hint?: string;
  variant?: "default" | "emerald";
  href?: string;
  icon?: ReactNode;
};

export function DashboardStatCard({
  label,
  value,
  hint,
  variant = "default",
  href,
  icon,
}: DashboardStatCardProps) {
  const content = (
    <div className="flex items-start gap-3">
      {icon && (
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            variant === "emerald"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
              : "bg-[#d4f0e6] text-[#026842] dark:bg-emerald-950/30 dark:text-emerald-400"
          }`}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[#6b7280] dark:text-zinc-400">{label}</p>
        <p
          className={`mt-1 text-2xl font-bold leading-tight line-clamp-2 ${
            variant === "emerald"
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-[#026842] dark:text-zinc-100"
          }`}
        >
          {value}
        </p>
        {hint && (
          <p className="mt-1 text-xs text-[#6b7280]/80 dark:text-zinc-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  );

  const className =
    "admin-card block p-4 transition hover:-translate-y-0.5 hover:border-emerald-200/80 hover:shadow-md dark:hover:border-emerald-900/40";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
