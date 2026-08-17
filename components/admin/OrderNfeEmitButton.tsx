"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatApiError } from "@/lib/apiError";
import {
  checkEmissorUp,
  emitNfeFromBrowser,
  readNfeEmissorToken,
} from "@/lib/nfe/client";

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

  async function emit(modelo: 55 | 65) {
    setLoading(String(modelo) as "55" | "65");
    setError("");
    setMessage("");

    try {
      if (!readNfeEmissorToken()) {
        throw new Error(
          "Cole o token do emissor em Admin → Emissor."
        );
      }

      const up = await checkEmissorUp();
      if (!up) {
        throw new Error(
          "Emissor local offline. Abra Admin → Emissor e clique em Iniciar emissor."
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao emitir.");
    } finally {
      setLoading(null);
    }
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
    </div>
  );
}
