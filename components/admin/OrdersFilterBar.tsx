"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ORDER_STATUS_FILTERS,
  type AdminOrderStatusFilter,
} from "@/lib/order-admin-shared";

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      aria-hidden
    />
  );
}

export function OrdersFilterBar({
  initialStatus,
  initialQuery,
}: {
  initialStatus: AdminOrderStatusFilter;
  initialQuery: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [loadingFilter, setLoadingFilter] =
    useState<AdminOrderStatusFilter | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextDebounce = useRef(false);

  useEffect(() => {
    setQuery(initialQuery);
    setLoadingFilter(null);
    setSearchLoading(false);
  }, [initialQuery, initialStatus]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function navigate(next: {
    status?: AdminOrderStatusFilter;
    q?: string;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    const status = next.status ?? initialStatus;
    const q = (next.q ?? query).trim();

    if (status && status !== "all") params.set("status", status);
    else params.delete("status");

    if (q) params.set("q", q);
    else params.delete("q");

    const qs = params.toString();
    const href = qs ? `/admin/pedidos?${qs}` : "/admin/pedidos";
    const current = searchParams.toString()
      ? `/admin/pedidos?${searchParams.toString()}`
      : "/admin/pedidos";
    if (href === current) {
      setLoadingFilter(null);
      setSearchLoading(false);
      return;
    }

    startTransition(() => {
      router.push(href);
    });
  }

  function onFilterClick(status: AdminOrderStatusFilter) {
    if (pending && loadingFilter === status) return;
    setLoadingFilter(status);
    setSearchLoading(false);
    navigate({ status, q: query });
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (skipNextDebounce.current) {
      skipNextDebounce.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchLoading(true);
    setLoadingFilter(null);
    debounceRef.current = setTimeout(() => {
      navigate({ q: value, status: initialStatus });
    }, 280);
  }

  function clearAll() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    skipNextDebounce.current = true;
    setQuery("");
    setLoadingFilter(null);
    setSearchLoading(true);
    startTransition(() => {
      router.push("/admin/pedidos");
    });
  }

  const showClear = Boolean(query.trim() || initialStatus !== "all");
  const isBusy = pending || searchLoading;

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap gap-2">
        {ORDER_STATUS_FILTERS.map((filter) => {
          const active = initialStatus === filter.id;
          const loading = pending && loadingFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              disabled={pending && loadingFilter !== null && !loading}
              onClick={() => onFilterClick(filter.id)}
              aria-pressed={active}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition select-none touch-manipulation disabled:cursor-wait ${
                active
                  ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30 ring-offset-1 dark:ring-offset-zinc-950"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40"
              } ${loading ? "opacity-90" : ""}`}
            >
              {loading && <Spinner />}
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Digite 1, PD1 ou PD0001…"
          className="admin-input w-full px-3 py-2.5 pr-20 text-sm"
          aria-label="Buscar venda pelo número"
          inputMode="search"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {isBusy && !loadingFilter && (
            <Spinner className="text-emerald-600 dark:text-emerald-400" />
          )}
          {showClear && (
            <button
              type="button"
              onClick={clearAll}
              disabled={pending}
              className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-wait dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {query.trim() && /^\d+$/.test(query.trim()) && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Buscando venda{" "}
          <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">
            PD{query.trim().padStart(4, "0")}
          </span>
        </p>
      )}
    </div>
  );
}
