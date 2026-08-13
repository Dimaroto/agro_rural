import type { StockStatus } from "@/lib/format";
import {
  BoltIcon,
  CheckIcon,
  PackageIcon,
} from "@/components/icons/UiIcons";
import type { ComponentType } from "react";

const config: Record<
  StockStatus,
  {
    Icon: ComponentType<{ className?: string }>;
    className: string;
    qtySuffix?: boolean;
  }
> = {
  in_stock: {
    Icon: CheckIcon,
    className:
      "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
    qtySuffix: true,
  },
  low_stock: {
    Icon: BoltIcon,
    className: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
    qtySuffix: true,
  },
  out_of_stock: {
    Icon: PackageIcon,
    className: "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200",
    qtySuffix: false,
  },
};

const labels: Record<StockStatus, string> = {
  in_stock: "Em estoque",
  low_stock: "Últimas unidades",
  out_of_stock: "Esgotado",
};

export function StockBadge({
  status,
  available,
  compact = false,
  overlay = false,
}: {
  status: StockStatus;
  available?: number;
  compact?: boolean;
  overlay?: boolean;
}) {
  const { Icon, className, qtySuffix } = config[status];
  const label = labels[status];
  const qty =
    qtySuffix && available !== undefined
      ? ` · ${available} un.`
      : "";

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 truncate font-semibold ${className} ${
        overlay
          ? "rounded-lg px-2 py-1 text-[10px] shadow-sm backdrop-blur-sm"
          : compact
            ? "rounded-full px-2 py-0.5 text-[10px]"
            : "rounded-full px-2.5 py-1 text-xs"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {label}
        {qty}
      </span>
    </span>
  );
}
