import { formatPrice } from "@/lib/format";

export function FinanceBarChart({
  items,
  mode = "income",
}: {
  items: { label: string; incomeCents: number; expenseCents: number }[];
  mode?: "income" | "expense" | "both";
}) {
  const max = Math.max(
    1,
    ...items.flatMap((i) =>
      mode === "income"
        ? [i.incomeCents]
        : mode === "expense"
          ? [i.expenseCents]
          : [i.incomeCents, i.expenseCents]
    )
  );

  return (
    <div className="finance-bar-chart admin-card p-4">
      {items.map((item) => {
        const value =
          mode === "expense" ? item.expenseCents : item.incomeCents;
        const pct = Math.round((value / max) * 100);
        return (
          <div key={item.label} className="space-y-2">
            <div className="finance-bar-chart__row">
              <span className="text-[#6b7280] dark:text-zinc-400">
                {item.label}
              </span>
              <div className="finance-bar-chart__track">
                <div
                  className={`finance-bar-chart__fill ${
                    mode === "expense" ? "finance-bar-chart__fill--expense" : ""
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-right font-medium text-[#026842] dark:text-zinc-200">
                {formatPrice(value)}
              </span>
            </div>
            {mode === "both" && (
              <div className="finance-bar-chart__row pl-0">
                <span className="text-[#6b7280] dark:text-zinc-400">Desp.</span>
                <div className="finance-bar-chart__track">
                  <div
                    className="finance-bar-chart__fill finance-bar-chart__fill--expense"
                    style={{
                      width: `${Math.round((item.expenseCents / max) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-right font-medium text-[#026842] dark:text-zinc-200">
                  {formatPrice(item.expenseCents)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
