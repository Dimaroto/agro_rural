"use client";

import { useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/lib/apiError";
import { formatPrice } from "@/lib/format";
import { formatOrderCode } from "@/lib/order-number";
import {
  checkEmissorUp,
  emitNfeFromBrowser,
  readNfeEmissorToken,
} from "@/lib/nfe/client";
import { fetchLocalToken } from "@/lib/nfe/fiscal-api";

export type NfeSaidaOrder = {
  id: string;
  orderNumber?: number | null;
  customerName?: string | null;
  totalCents: number;
  status?: string;
  nfeChave?: string | null;
  nfeStatus?: string | null;
  nfeNumero?: number | null;
  createdAt?: string | Date;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onEmitted: () => void;
  onAlreadyEmitted: (order: NfeSaidaOrder) => void;
  onError?: (error: string) => void;
  onMessage?: (msg: string) => void;
};

async function ensureToken(): Promise<string> {
  let token = readNfeEmissorToken();
  if (token) return token;
  token = await fetchLocalToken();
  if (token) return token;
  throw new Error(
    "Token do emissor não encontrado. Entre em Notas Fiscais → Saída ou cole o token na emissão."
  );
}

export function NfeSaidaOrderPickerSheet({
  open,
  onClose,
  onEmitted,
  onAlreadyEmitted,
  onError,
  onMessage,
}: Props) {
  const [orders, setOrders] = useState<NfeSaidaOrder[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setError("");
    setEmittingId(null);
    void loadOrders();
  }, [open]);

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/orders");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          formatApiError(
            data && typeof data === "object" ? (data as { error?: unknown }).error : null,
            "Não foi possível carregar as vendas."
          )
        );
      }
      setOrders(Array.isArray(data) ? (data as NfeSaidaOrder[]) : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar vendas.";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const code = formatOrderCode(o.orderNumber, o.id).toLowerCase();
      const name = (o.customerName ?? "").toLowerCase();
      return name.includes(q) || code.includes(q) || String(o.orderNumber ?? "").includes(q);
    });
  }, [orders, search]);

  function reportError(text: string) {
    setError(text);
    onError?.(text);
  }

  async function selectOrder(order: NfeSaidaOrder) {
    const chave = (order.nfeChave ?? "").replace(/\D/g, "");
    const autorizada =
      String(order.nfeStatus ?? "").toLowerCase() === "autorizada" &&
      chave.length === 44;

    if (autorizada) {
      onAlreadyEmitted(order);
      onClose();
      return;
    }

    setEmittingId(order.id);
    setError("");
    try {
      await ensureToken();

      const up = await checkEmissorUp();
      if (!up) {
        const desktop = (
          window as Window & {
            agroDesktop?: { isDesktop?: boolean };
          }
        ).agroDesktop;
        if (!desktop?.isDesktop) {
          throw new Error(
            "Emissor local offline. Abra o app Agro Rural no Windows (não o navegador) e use «Iniciar emissor»."
          );
        }
      }

      const prep = await fetch(
        `/api/admin/orders/${order.id}/nfe-payload?modelo=55`
      );
      const prepData = await prep.json().catch(() => ({}));
      if (!prep.ok) {
        const apiMsg =
          typeof prepData.error === "string" && prepData.error.trim()
            ? prepData.error.trim()
            : formatApiError(
                prepData.error,
                "Não foi possível preparar a nota."
              );
        throw new Error(apiMsg);
      }

      const result = await emitNfeFromBrowser({
        modelo: 55,
        payload: prepData.payload,
      });

      const resultChave =
        (result.chaveAcesso ?? "").replace(/\D/g, "") || null;
      const statusNorm = String(result.status ?? "")
        .toLowerCase()
        .trim();
      const ok = statusNorm === "autorizada" && Boolean(resultChave);

      const patch = await fetch(`/api/admin/orders/${order.id}/nfe-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nfeChave: resultChave,
          nfeStatus: ok ? "autorizada" : result.status ?? null,
          nfeNumero: result.numero ?? null,
          nfeModelo: 55,
          nfeProtocolo: result.protocolo ?? null,
          nfeEmitidoAt: ok ? new Date().toISOString() : null,
        }),
      });
      if (!patch.ok) {
        const patchData = await patch.json().catch(() => ({}));
        throw new Error(
          typeof patchData.error === "string"
            ? patchData.error
            : "Nota emitida, mas falhou ao salvar o status na venda. Atualize a página."
        );
      }

      if (ok) {
        onMessage?.(
          `NF-e autorizada${result.numero != null ? ` nº ${result.numero}` : ""} para ${formatOrderCode(order.orderNumber, order.id)}.`
        );
      } else {
        const m = result.mensagem?.trim();
        onMessage?.(
          m && !m.startsWith("{") && m.length < 180
            ? m
            : `Status: ${result.status || "processado"}`
        );
      }
      onEmitted();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Falha ao emitir.";
      reportError(
        raw.trim().startsWith("{")
          ? "Falha ao emitir. Tente de novo; se persistir, reinicie o emissor."
          : raw
      );
    } finally {
      setEmittingId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="admin-sheet-root" role="presentation">
      <button
        type="button"
        className="admin-sheet-backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className="admin-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nfe-saida-sheet-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2
            id="nfe-saida-sheet-title"
            className="text-lg font-semibold text-[#2D4C1E] dark:text-zinc-100"
          >
            Emitir NF-e de saída
          </h2>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
          Selecione a venda. Se já houver NF-e autorizada, abrimos os documentos;
          caso contrário, emitimos agora.
        </p>

        <label className="block text-sm mb-3">
          <span className="sr-only">Pesquisar vendas</span>
          <input
            type="search"
            className="finance-input w-full"
            placeholder="Pesquisar por cliente ou código da venda…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        {error ? <p className="admin-error mb-3">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-zinc-500">Carregando vendas…</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((order) => {
              const code = formatOrderCode(order.orderNumber, order.id);
              const already =
                String(order.nfeStatus ?? "").toLowerCase() === "autorizada" &&
                (order.nfeChave ?? "").replace(/\D/g, "").length === 44;
              const busy = emittingId === order.id;
              return (
                <li key={order.id}>
                  <button
                    type="button"
                    className="admin-card w-full p-3 text-left text-sm transition hover:bg-[#E4EAD8]/50 dark:hover:bg-zinc-800/80 disabled:opacity-60"
                    disabled={emittingId !== null}
                    onClick={() => void selectOrder(order)}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono font-semibold">{code}</span>
                      <span className="font-medium">
                        {formatPrice(order.totalCents)}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                      {order.customerName?.trim() || "Sem cliente"}
                      {already ? (
                        <span className="ml-2 text-emerald-700 dark:text-emerald-400">
                          · NF-e autorizada
                        </span>
                      ) : null}
                    </p>
                    {busy ? (
                      <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                        Emitindo…
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="text-sm text-zinc-500">
                {search.trim()
                  ? "Nenhuma venda corresponde à pesquisa."
                  : "Nenhuma venda encontrada."}
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
