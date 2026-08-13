"use client";

import { useCallback, useRef, useState } from "react";

const btnClass =
  "flex h-11 items-center justify-center rounded-lg bg-zinc-100 text-sm font-medium text-zinc-800 transition hover:bg-zinc-200 active:scale-[0.98] dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

const opClass =
  "flex h-11 items-center justify-center rounded-lg bg-emerald-100 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-200 active:scale-[0.98] dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900";

function formatNumForDisplay(n: number): string {
  if (!Number.isFinite(n)) return "Erro";
  const text = String(n);
  return text.includes(".") ? text.replace(".", ",") : text;
}

function parseDisplayValue(value: string): number {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const OP_SYMBOL: Record<string, string> = {
  "+": "+",
  "-": "−",
  "×": "×",
  "÷": "÷",
};

function preventFocusSteal(e: React.MouseEvent) {
  e.preventDefault();
}

export function AdminStickyCalculator() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [entry, setEntry] = useState("0");
  const [expression, setExpression] = useState("");
  const [stored, setStored] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [freshEntry, setFreshEntry] = useState(true);

  const inputDigit = useCallback((digit: string) => {
    setEntry((prev) => {
      const starting =
        freshEntry || prev === "0" || prev === "Erro";
      if (starting) {
        setFreshEntry(false);
        return digit === "," ? "0," : digit;
      }
      if (digit === "," && prev.includes(",")) return prev;
      return prev + digit;
    });
  }, [freshEntry]);

  const parseEntry = useCallback(() => parseDisplayValue(entry), [entry]);

  const applyOp = useCallback((a: number, b: number, op: string): number | "Erro" => {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? "Erro" : a / b;
      default:
        return b;
    }
  }, []);

  const clearAll = useCallback(() => {
    setEntry("0");
    setExpression("");
    setStored(null);
    setPendingOp(null);
    setFreshEntry(true);
  }, []);

  const clearEntry = useCallback(() => {
    setEntry("0");
    setFreshEntry(true);
  }, []);

  const chooseOp = useCallback(
    (op: string) => {
      const current = parseEntry();
      if (stored != null && pendingOp && !freshEntry) {
        const result = applyOp(stored, current, pendingOp);
        if (result === "Erro") {
          setEntry("Erro");
          setExpression("");
          setStored(null);
          setPendingOp(null);
          setFreshEntry(true);
          return;
        }
        setStored(result);
        setEntry("0");
        setExpression(`${formatNumForDisplay(result)} ${OP_SYMBOL[op] ?? op}`);
      } else {
        setStored(current);
        setExpression(`${formatNumForDisplay(current)} ${OP_SYMBOL[op] ?? op}`);
        setEntry("0");
      }
      setPendingOp(op);
      setFreshEntry(true);
    },
    [applyOp, freshEntry, parseEntry, pendingOp, stored]
  );

  const equals = useCallback(() => {
    if (stored == null || !pendingOp) return;
    const current = parseEntry();
    const result = applyOp(stored, current, pendingOp);
    if (result === "Erro") {
      setEntry("Erro");
      setExpression("");
    } else {
      const opSym = OP_SYMBOL[pendingOp] ?? pendingOp;
      setExpression(
        `${formatNumForDisplay(stored)} ${opSym} ${formatNumForDisplay(current)} =`
      );
      setEntry(formatNumForDisplay(result));
    }
    setStored(null);
    setPendingOp(null);
    setFreshEntry(true);
  }, [applyOp, parseEntry, pendingOp, stored]);

  const backspace = useCallback(() => {
    setFreshEntry(false);
    setEntry((prev) => {
      if (prev === "Erro") return "0";
      if (prev.length <= 1 || prev === "0") return "0";
      return prev.slice(0, -1);
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const key = e.key;
      if (/^\d$/.test(key)) {
        e.preventDefault();
        inputDigit(key);
        return;
      }
      if (key === "," || key === ".") {
        e.preventDefault();
        inputDigit(",");
        return;
      }
      if (key === "+") {
        e.preventDefault();
        chooseOp("+");
        return;
      }
      if (key === "-") {
        e.preventDefault();
        chooseOp("-");
        return;
      }
      if (key === "*") {
        e.preventDefault();
        chooseOp("×");
        return;
      }
      if (key === "/") {
        e.preventDefault();
        chooseOp("÷");
        return;
      }
      if (key === "Enter" || key === "=") {
        e.preventDefault();
        equals();
        return;
      }
      if (key === "Escape") {
        e.preventDefault();
        clearAll();
        return;
      }
      if (key === "Backspace") {
        e.preventDefault();
        backspace();
      }
    },
    [backspace, chooseOp, clearAll, equals, inputDigit]
  );

  const buttonProps = { onMouseDown: preventFocusSteal };

  return (
    <div
      ref={rootRef}
      className={`admin-card p-3 shadow-sm outline-none transition ring-offset-2 ring-offset-zinc-950 focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        focused ? "ring-2 ring-emerald-500/40" : ""
      }`}
      tabIndex={0}
      role="application"
      aria-label="Calculadora"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node)) {
          setFocused(false);
        }
      }}
      onKeyDown={handleKeyDown}
      onClick={() => rootRef.current?.focus()}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Calculadora
      </p>
      <p className="mb-0.5 text-[10px] text-zinc-500">
        Clique aqui e use o teclado (+ − * / Enter Esc)
      </p>
      <div className="mb-2 min-h-[3.25rem] rounded-lg bg-zinc-950 px-3 py-2">
        <div className="truncate text-right font-mono text-xs tabular-nums text-zinc-500">
          {expression || "\u00A0"}
        </div>
        <div
          className="truncate text-right font-mono text-xl tabular-nums text-emerald-400"
          aria-live="polite"
        >
          {entry}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button type="button" className={btnClass} {...buttonProps} onClick={clearAll}>
          C
        </button>
        <button type="button" className={btnClass} {...buttonProps} onClick={clearEntry}>
          CE
        </button>
        <button type="button" className={opClass} {...buttonProps} onClick={() => chooseOp("÷")}>
          ÷
        </button>
        <button type="button" className={opClass} {...buttonProps} onClick={() => chooseOp("×")}>
          ×
        </button>

        {["7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            className={btnClass}
            {...buttonProps}
            onClick={() => inputDigit(d)}
          >
            {d}
          </button>
        ))}
        <button type="button" className={opClass} {...buttonProps} onClick={() => chooseOp("-")}>
          −
        </button>

        {["4", "5", "6"].map((d) => (
          <button
            key={d}
            type="button"
            className={btnClass}
            {...buttonProps}
            onClick={() => inputDigit(d)}
          >
            {d}
          </button>
        ))}
        <button type="button" className={opClass} {...buttonProps} onClick={() => chooseOp("+")}>
          +
        </button>

        {["1", "2", "3"].map((d) => (
          <button
            key={d}
            type="button"
            className={btnClass}
            {...buttonProps}
            onClick={() => inputDigit(d)}
          >
            {d}
          </button>
        ))}
        <button
          type="button"
          className={`${opClass} row-span-2 h-auto min-h-[5.75rem]`}
          {...buttonProps}
          onClick={equals}
        >
          =
        </button>

        <button
          type="button"
          className={`${btnClass} col-span-2`}
          {...buttonProps}
          onClick={() => inputDigit("0")}
        >
          0
        </button>
        <button type="button" className={btnClass} {...buttonProps} onClick={() => inputDigit(",")}>
          ,
        </button>
      </div>
    </div>
  );
}
