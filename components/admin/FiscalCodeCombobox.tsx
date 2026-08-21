"use client";

import { useEffect, useId, useRef, useState } from "react";

type FiscalItem = { code: string; description: string };

type Props = {
  kind: "ncm" | "cfop";
  name: string;
  label?: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  maxDigits?: number;
  className?: string;
};

export function FiscalCodeCombobox({
  kind,
  name,
  defaultValue = "",
  placeholder,
  required,
  maxDigits,
  className = "admin-input w-full px-3 py-2.5 text-sm",
}: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(defaultValue ?? "");
  const [selected, setSelected] = useState<FiscalItem | null>(null);
  const [items, setItems] = useState<FiscalItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const digitsOnly = maxDigits ?? (kind === "ncm" ? 8 : 4);

  useEffect(() => {
    const initial = (defaultValue ?? "").replace(/\D/g, "");
    if (!initial) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/fiscal/${kind}?code=${encodeURIComponent(initial)}`
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.item) {
          setSelected(data.item as FiscalItem);
          setQuery(data.item.code);
        } else {
          setQuery(initial);
        }
      } catch {
        if (!cancelled) setQuery(initial);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultValue, kind]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(
            `/api/admin/fiscal/${kind}?q=${encodeURIComponent(q)}&limit=25`
          );
          const data = await res.json().catch(() => ({}));
          setItems((data.items as FiscalItem[]) ?? []);
        } catch {
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 200);
    return () => window.clearTimeout(t);
  }, [query, kind, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const value =
    selected?.code || query.replace(/\D/g, "").slice(0, digitsOnly) || "";

  return (
    <div ref={wrapRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={
          selected
            ? `${selected.code} — ${selected.description}`
            : query
        }
        onChange={(e) => {
          setSelected(null);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={
          placeholder ??
          (kind === "ncm"
            ? "Digite o NCM ou a descrição…"
            : "Digite o CFOP ou a descrição…")
        }
        className={className}
        autoComplete="off"
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
        >
          {loading ? (
            <li className="px-3 py-2 text-xs text-zinc-500">Buscando…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-500">
              {query.trim()
                ? "Nenhum resultado. Continue digitando."
                : kind === "cfop"
                  ? "Digite para filtrar a tabela CFOP."
                  : "Digite código ou descrição do NCM."}
            </li>
          ) : (
            items.map((item) => (
              <li key={item.code} role="option">
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 border-b border-zinc-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-emerald-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  onClick={() => {
                    setSelected(item);
                    setQuery(item.code);
                    setOpen(false);
                  }}
                >
                  <span className="font-mono text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                    {item.code}
                  </span>
                  <span className="text-xs leading-snug text-zinc-600 dark:text-zinc-300">
                    {item.description}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {selected ? (
        <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
          Selecionado:{" "}
          <span className="font-mono text-zinc-700 dark:text-zinc-200">
            {selected.code}
          </span>
        </p>
      ) : null}
    </div>
  );
}
