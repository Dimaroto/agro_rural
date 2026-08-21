"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import type { PdvProductListItem } from "@/lib/pdv-shared";
import {
  formatWeightDigitsMask,
  gramsToKgLabel,
  gramsToWeightDigits,
  lineTotalCentsFromGrams,
  parseWeightDigitsToGrams,
} from "@/lib/stock-unit";

type PdvWeightQtySheetProps = {
  product: PdvProductListItem;
  /** Gramas já no carrinho (para editar). */
  initialGrams?: number;
  onConfirm: (grams: number) => void;
  onClose: () => void;
};

export function PdvWeightQtySheet({
  product,
  initialGrams = 0,
  onConfirm,
  onClose,
}: PdvWeightQtySheetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [digits, setDigits] = useState(() =>
    initialGrams > 0 ? gramsToWeightDigits(initialGrams) : ""
  );
  const [error, setError] = useState("");

  const grams = parseWeightDigitsToGrams(digits);
  const max = Math.max(0, Math.floor(product.available));

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [product.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    if (grams <= 0) {
      setError("Informe a quantidade em kg.");
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    if (grams > max) {
      setError(`Máximo disponível: ${gramsToKgLabel(max)}`);
      inputRef.current?.focus();
      inputRef.current?.select();
      return;
    }
    setError("");
    onConfirm(grams);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Quantidade de ${product.name}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {product.codeLabel}
            </p>
            <h2 className="truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {product.name}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {formatPrice(product.priceCents)} / kg · Disponível{" "}
              {gramsToKgLabel(max)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Esc
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Quantidade (kg)
        </label>
        <div className="relative mt-1.5">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={formatWeightDigitsMask(digits)}
            onChange={(e) => {
              setDigits(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            className="admin-input w-full px-3 py-3 pr-12 text-center text-2xl font-bold tabular-nums tracking-wide"
            aria-label="Quantidade em quilos"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
            kg
          </span>
        </div>
        <p className="mt-1.5 text-center text-xs text-zinc-400">
          Digite só números e Enter — a vírgula entra sozinha
        </p>

        {grams > 0 ? (
          <p className="mt-3 text-center text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Total {formatPrice(lineTotalCentsFromGrams(product.priceCents, grams))}
          </p>
        ) : null}

        {error ? (
          <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="admin-btn-secondary min-h-11"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            className="admin-btn-primary min-h-11"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
