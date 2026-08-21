"use client";

import type { FiscalOption } from "@/lib/fiscal/product-fiscal-options";

type Props = {
  name: string;
  options: FiscalOption[];
  defaultValue?: string | null;
  className?: string;
  allowCustom?: boolean;
};

/**
 * Select com descrição visível. Se allowCustom e o valor não está na lista,
 * inclui a opção atual para não perder dado legado.
 */
export function FiscalOptionSelect({
  name,
  options,
  defaultValue = "",
  className = "admin-input w-full px-3 py-2.5 text-sm",
  allowCustom = true,
}: Props) {
  const initial = (defaultValue ?? "").trim();
  const known = options.some((o) => o.value === initial);
  const list =
    allowCustom && initial && !known
      ? [{ value: initial, label: `${initial} (atual)` }, ...options]
      : options;

  return (
    <select
      name={name}
      defaultValue={initial || options[0]?.value || ""}
      className={className}
    >
      {list.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
