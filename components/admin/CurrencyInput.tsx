"use client";

import { formatCentsBank, parseBankDigitsToCents } from "@/lib/format";

type CurrencyInputProps = {
  valueCents: number;
  onChange: (cents: number) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
};

/** Digita só números; vírgula e milhar entram sozinhos (padrão banco). */
export function CurrencyInput({
  valueCents,
  onChange,
  className,
  required,
  placeholder = "0,00",
  id,
  "aria-label": ariaLabel,
}: CurrencyInputProps) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      required={required}
      aria-label={ariaLabel}
      className={className}
      placeholder={placeholder}
      value={formatCentsBank(valueCents)}
      onChange={(e) => onChange(parseBankDigitsToCents(e.target.value))}
      onFocus={(e) => e.target.select()}
    />
  );
}
