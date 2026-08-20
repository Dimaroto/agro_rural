"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/apiError";
import {
  checkEmissorUp,
  emitNfeFromBrowser,
  readNfeEmissorToken,
  writeNfeEmissorToken,
} from "@/lib/nfe/client";
import { fetchLocalToken } from "@/lib/nfe/fiscal-api";
import Link from "next/link";

type Props = {
  orderId: string;
  nfeChave?: string | null;
  nfeStatus?: string | null;
  nfeNumero?: number | null;
  disabled?: boolean;
};

export function OrderNfeEmitButton({
  orderId,
  nfeChave,
  nfeStatus,
  nfeNumero,
  disabled,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"55" | "65" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [tokenDraft, setTokenDraft] = useState("");
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(readNfeEmissorToken()));
  }, []);

  async function ensureToken(): Promise<string> {
    let token = readNfeEmissorToken();
    if (token) {
      setHasToken(true);
      return token;
    }
    try {
      token = await fetchLocalToken();
      if (token) {
        setHasToken(true);
        return token;
      }
    } catch {
      /* cai no pedido manual */
    }
    setShowTokenHelp(true);
    throw new Error(
      "Token do emissor não encontrado. Cole abaixo ou entre em Notas Fiscais → Saída."
    );
  }

  async function emit(modelo: 55 | 65) {
    setLoading(String(modelo) as "55" | "65");
    setError("");
    setMessage("");

    try {
      await ensureToken();

      const up = await checkEmissorUp();
      if (!up) {
        throw new Error(
          "Emissor local offline. Use Abrir emissor na barra do app Windows."
        );
      }

      const prep = await fetch(
        `/api/admin/orders/${orderId}/nfe-payload?modelo=${modelo}`
      );
      const prepData = await prep.json().catch(() => ({}));
      if (!prep.ok) {
        throw new Error(
          formatApiError(prepData.error, "Não foi possível preparar a nota.")
        );
      }

      const result = await emitNfeFromBrowser({
        modelo,
        payload: prepData.payload,
      });

      await fetch(`/api/admin/orders/${orderId}/nfe-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nfeChave: result.chaveAcesso ?? null,
          nfeStatus: result.status ?? null,
          nfeNumero: result.numero ?? null,
          nfeModelo: modelo,
          nfeProtocolo: result.protocolo ?? null,
          nfeEmitidoAt:
            result.status === "autorizada" ? new Date().toISOString() : null,
        }),
      });

      setMessage(
        result.status === "autorizada"
          ? `NF-${modelo === 65 ? "C" : ""}e autorizada${result.numero != null ? ` nº ${result.numero}` : ""}.`
          : result.mensagem || `Status: ${result.status}`
      );
      setShowTokenHelp(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao emitir.");
    } finally {
      setLoading(null);
    }
  }

  function saveTokenDraft() {
    const t = tokenDraft.trim();
    if (!t) {
      setError("Cole o token gerado no emissor (Revisão → Gerar token).");
      return;
    }
    writeNfeEmissorToken(t);
    setTokenDraft("");
    setShowTokenHelp(false);
    setHasToken(true);
    setError("");
    setMessage("Token salvo neste aparelho. Tente emitir de novo.");
  }

  const alreadyOk = nfeStatus === "autorizada" && nfeChave;

  return (
    <div className="mt-2 space-y-1.5">
      {alreadyOk ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          NF-e autorizada
          {nfeNumero != null ? ` nº ${nfeNumero}` : ""} · chave{" "}
          <span className="font-mono">{nfeChave.slice(0, 10)}…</span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || loading !== null}
          onClick={() => emit(55)}
          className="rounded-lg border border-emerald-700/40 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-50 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          {loading === "55" ? "Emitindo…" : "Emitir NF-e"}
        </button>
        <button
          type="button"
          disabled={disabled || loading !== null}
          onClick={() => emit(65)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {loading === "65" ? "Emitindo…" : "Emitir NFC-e"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {message ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p>
      ) : null}
      {showTokenHelp || (!hasToken && !loading) ? (
        <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs text-amber-900 dark:text-amber-200">
            Token Sanctum: no emissor, vá até a etapa{" "}
            <strong>Revisão</strong> → <strong>Gerar token de integração</strong>
            , copie e cole aqui (ou faça login em{" "}
            <Link href="/admin/notas" className="underline">
              Notas Fiscais → Saída
            </Link>
            ).
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="admin-input min-w-[12rem] flex-1 px-2 py-1.5 text-xs font-mono"
              placeholder="Cole o token aqui…"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
            />
            <button
              type="button"
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
              onClick={saveTokenDraft}
            >
              Salvar token
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
