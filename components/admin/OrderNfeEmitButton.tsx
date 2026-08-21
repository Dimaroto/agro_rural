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
import {
  downloadDanfe,
  downloadXml,
  openDanfe,
} from "@/lib/nfe/documents";
import { fetchLocalToken } from "@/lib/nfe/fiscal-api";
import Link from "next/link";

type Props = {
  orderId: string;
  nfeChave?: string | null;
  nfeStatus?: string | null;
  nfeNumero?: number | null;
  disabled?: boolean;
  /** Botão Emitir/DANFE na mesma linha das outras ações do card. */
  toolbar?: boolean;
};

export function OrderNfeEmitButton({
  orderId,
  nfeChave,
  nfeStatus,
  nfeNumero,
  disabled,
  toolbar = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [docBusy, setDocBusy] = useState<"print" | "danfe" | "xml" | null>(
    null
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [chaveLocal, setChaveLocal] = useState(nfeChave ?? "");
  const [statusLocal, setStatusLocal] = useState(nfeStatus ?? "");
  const [numeroLocal, setNumeroLocal] = useState(nfeNumero ?? null);

  const [tokenDraft, setTokenDraft] = useState("");
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(readNfeEmissorToken()));
  }, []);

  useEffect(() => {
    setChaveLocal(nfeChave ?? "");
    setStatusLocal(nfeStatus ?? "");
    setNumeroLocal(nfeNumero ?? null);
  }, [nfeChave, nfeStatus, nfeNumero]);

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

  async function emit() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await ensureToken();

      const up = await checkEmissorUp();
      if (!up) {
        const desktop = (
          window as Window & {
            agroDesktop?: { isDesktop?: boolean; requestEmissor?: unknown };
          }
        ).agroDesktop;
        if (!desktop?.isDesktop) {
          throw new Error(
            "Emissor local offline. Abra o app Agro Rural no Windows (não o navegador) e use «Iniciar emissor»."
          );
        }
      }

      const prep = await fetch(
        `/api/admin/orders/${orderId}/nfe-payload?modelo=55`
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

      const chave =
        (result.chaveAcesso ?? "").replace(/\D/g, "") || null;
      const statusNorm = String(result.status ?? "")
        .toLowerCase()
        .trim();
      const autorizada = statusNorm === "autorizada" && Boolean(chave);

      const patch = await fetch(`/api/admin/orders/${orderId}/nfe-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nfeChave: chave,
          nfeStatus: autorizada ? "autorizada" : result.status ?? null,
          nfeNumero: result.numero ?? null,
          nfeModelo: 55,
          nfeProtocolo: result.protocolo ?? null,
          nfeEmitidoAt: autorizada ? new Date().toISOString() : null,
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

      if (chave) setChaveLocal(chave);
      if (autorizada) setStatusLocal("autorizada");
      else if (result.status) setStatusLocal(String(result.status));
      if (result.numero != null) setNumeroLocal(result.numero);

      const shortMsg = (() => {
        if (autorizada) {
          return `NF-e autorizada${result.numero != null ? ` nº ${result.numero}` : ""}.`;
        }
        const m = result.mensagem?.trim();
        if (m && !m.startsWith("{") && m.length < 180) return m;
        return `Status: ${result.status || "processado"}`;
      })();
      setMessage(shortMsg);
      setShowTokenHelp(false);
      router.refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Falha ao emitir.";
      setError(
        raw.trim().startsWith("{")
          ? "Falha ao emitir. Tente de novo; se persistir, reinicie o emissor."
          : raw
      );
    } finally {
      setLoading(false);
    }
  }

  async function runDoc(action: "print" | "danfe" | "xml") {
    const chave = chaveLocal.replace(/\D/g, "");
    if (chave.length !== 44) {
      setError("Nota sem chave de acesso para gerar o DANFE.");
      return;
    }
    setDocBusy(action);
    setError("");
    try {
      await ensureToken();
      if (action === "print") await openDanfe(chave);
      else if (action === "danfe") await downloadDanfe(chave);
      else await downloadXml(chave);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao abrir documento.");
    } finally {
      setDocBusy(null);
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

  const alreadyOk =
    String(statusLocal).toLowerCase() === "autorizada" &&
    chaveLocal.replace(/\D/g, "").length === 44;
  const btnClass =
    "admin-btn-secondary min-h-[2.75rem] px-3 py-2 text-xs md:min-h-0";
  const emitClass =
    "inline-flex min-h-[2.75rem] cursor-pointer items-center justify-center rounded-xl border border-emerald-700/40 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50 md:min-h-0 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/70";

  const actions = alreadyOk ? (
    <>
      <button
        type="button"
        disabled={disabled || docBusy !== null}
        onClick={() => void runDoc("print")}
        className={btnClass}
      >
        {docBusy === "print" ? "Abrindo…" : "Imprimir DANFE"}
      </button>
      <button
        type="button"
        disabled={disabled || docBusy !== null}
        onClick={() => void runDoc("danfe")}
        className={btnClass}
      >
        {docBusy === "danfe" ? "Salvando…" : "Salvar DANFE"}
      </button>
      <button
        type="button"
        disabled={disabled || docBusy !== null}
        onClick={() => void runDoc("xml")}
        className={btnClass}
      >
        {docBusy === "xml" ? "Salvando…" : "Salvar XML"}
      </button>
    </>
  ) : (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={() => void emit()}
      className={emitClass}
    >
      {loading ? "Emitindo…" : "Emitir NF-e"}
    </button>
  );

  const feedback = (
    <>
      {alreadyOk ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          NF-e autorizada
          {numeroLocal != null ? ` nº ${numeroLocal}` : ""} · chave{" "}
          <span className="font-mono">{chaveLocal.replace(/\D/g, "").slice(0, 10)}
          …</span>
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {message && !message.trim().startsWith("{") ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p>
      ) : null}
      {showTokenHelp || (!hasToken && !loading && !alreadyOk) ? (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/30">
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
    </>
  );

  if (toolbar) {
    return (
      <>
        {actions}
        {(error || message || showTokenHelp || (!hasToken && !alreadyOk) || alreadyOk) && (
          <div className="basis-full space-y-1.5 pt-1">{feedback}</div>
        )}
      </>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-2">{actions}</div>
      {feedback}
    </div>
  );
}
