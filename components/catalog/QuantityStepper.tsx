"use client";

import { useEffect, useState } from "react";

type QuantityStepperProps = {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  compact?: boolean;
  id?: string;
};

export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  compact = false,
  id,
}: QuantityStepperProps) {
  const cap = Math.max(0, max);
  const lo = Math.min(min, cap);
  const canDecrease = !disabled && value > lo;
  const canIncrease = !disabled && value < cap;
  const btnClass = compact ? "h-8 w-8 text-base" : "h-11 w-11 text-lg";
  const inputClass = compact ? "h-8 w-10 text-sm" : "h-11 w-14 text-base";
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  function clamp(next: number) {
    if (cap < lo) return 0;
    return Math.min(cap, Math.max(lo, next));
  }

  function commit(raw: string) {
    const digits = raw.replace(/\D/g, "");
    const next = digits ? clamp(Number.parseInt(digits, 10)) : lo;
    onChange(next);
    setDraft(String(next));
  }

  function parseInput(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setDraft(digits);
    if (!digits) return;
    onChange(clamp(Number.parseInt(digits, 10)));
  }

  return (
    <div className="inline-flex items-center rounded-xl border border-brand/20 bg-white shadow-sm">
      <button
        type="button"
        disabled={!canDecrease}
        onClick={() => onChange(clamp(value - 1))}
        className={`flex items-center justify-center rounded-l-xl font-bold text-brand-dark transition-colors hover:bg-brand-light/50 disabled:cursor-not-allowed disabled:opacity-35 touch-manipulation ${btnClass}`}
        aria-label="Diminuir quantidade"
      >
        −
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        disabled={disabled || cap < lo}
        value={focused ? draft : String(value)}
        onFocus={() => {
          setFocused(true);
          setDraft(String(value));
        }}
        onChange={(e) => parseInput(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit(draft);
        }}
        className={`border-x border-brand/15 bg-transparent text-center font-bold tabular-nums text-brand-dark outline-none disabled:opacity-50 ${inputClass}`}
        aria-label="Quantidade"
      />
      <button
        type="button"
        disabled={!canIncrease}
        onClick={() => onChange(clamp(value + 1))}
        className={`flex items-center justify-center rounded-r-xl font-bold text-brand-dark transition-colors hover:bg-brand-light/50 disabled:cursor-not-allowed disabled:opacity-35 touch-manipulation ${btnClass}`}
        aria-label="Aumentar quantidade"
      >
        +
      </button>
    </div>
  );
}
