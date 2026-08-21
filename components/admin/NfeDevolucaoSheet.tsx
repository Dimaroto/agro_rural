"use client";

import { useEffect, useState } from "react";
import { formatApiError } from "@/lib/apiError";
import { formatPrice } from "@/lib/format";
import {
  checkEmissorUp,
  emitNfeFromBrowser,
  readNfeEmissorToken,
} from "@/lib/nfe/client";
import { fetchLocalToken } from "@/lib/nfe/fiscal-api";

type InvoiceItem = {
  id: string;
  name: string;
  quantity: number;
  unitCostCents: number;
  unit: string;
};

type Props = {
  open: boolean;
  purchaseId: string | null;
  onClose: () => void;
  onDone: () => void;
  onError?: (msg: string) => void;
  onMessage?: (msg: string) => void;
};

async function ensureToken(): Promise<string> {
  let token = readNfeEmissorToken();
  if (token) return token;
  token = await fetchLocalToken();
  if (token) return token;
  throw new Error(
    "Token do emissor não encontrado. Entre em Notas Fiscais → Saída."
  );
}

export function NfeDevolucaoSheet({
  open,
  purchaseId,
  onClose,
  onDone,
  onError,
  onMessage,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [header, setHeader] = useState("");
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [qtyById, setQtyById] = useState<Record<string, string>>({});
  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (!open || !purchaseId) return;
    setError("");
    setPayload(null);
    setBusy(false);
    void loadPreview(purchaseId);
  }, [open, purchaseId]);

  async function loadPreview(id: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/nfe/purchase/${id}/devolucao`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          formatApiError(data.error, "Não foi possível preparar a devolução.")
        );
      }
      setPayload(data.payload as Record<string, unknown>);
      const inv = data.invoice as {
        number: string;
        series: string;
        emitenteName: string;
        items: InvoiceItem[];
      };
      setHeader(
        `NF-e ${inv.number}/${inv.series} — ${inv.emitenteName}`
      );
      setItems(inv.items ?? []);
      const q: Record<string, string> = {};
      for (const it of inv.items ?? []) {
        q[it.id] = String(it.quantity);
      }
      setQtyById(q);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  async function emitir() {
    if (!purchaseId || !payload) return;
    setBusy(true);
    setError("");
    try {
      await ensureToken();
      const up = await checkEmissorUp();
      if (!up) {
        const desktop = (
          window as Window & { agroDesktop?: { isDesktop?: boolean } }
        ).agroDesktop;
        if (!desktop?.isDesktop) {
          throw new Error(
            "Emissor local offline. Abra o app Agro Rural e use «Iniciar emissor»."
          );
        }
      }

      const selected = items
        .map((it) => ({
          id: it.id,
          quantity: Number(String(qtyById[it.id] ?? "0").replace(",", ".")),
        }))
        .filter((s) => s.quantity > 0);

      if (selected.length === 0) {
        throw new Error("Informe a quantidade de ao menos um item.");
      }

      const rebuild = await fetch(
        `/api/admin/nfe/purchase/${purchaseId}/devolucao`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: selected, dryRun: true }),
        }
      );
      const rebuildData = await rebuild.json().catch(() => ({}));
      if (!rebuild.ok) {
        throw new Error(
          formatApiError(
            rebuildData.error,
            "Não foi possível montar o payload da devolução."
          )
        );
      }

      const result = await emitNfeFromBrowser({
        modelo: 55,
        payload: rebuildData.payload,
      });

      const chave =
        (result.chaveAcesso ?? "").replace(/\D/g, "") || null;
      const statusNorm = String(result.status ?? "")
        .toLowerCase()
        .trim();

      const confirm = await fetch(
        `/api/admin/nfe/purchase/${purchaseId}/devolucao`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: selected,
            nfeChave: chave,
            nfeStatus: statusNorm || result.status,
            nfeNumero: result.numero ?? null,
          }),
        }
      );
      const confirmData = await confirm.json().catch(() => ({}));
      if (!confirm.ok) {
        throw new Error(
          formatApiError(
            confirmData.error,
            "Nota emitida, mas falhou ao gravar a devolução."
          )
        );
      }

      const ok = statusNorm === "autorizada" && Boolean(chave);
      onMessage?.(
        ok
          ? `Devolução autorizada${result.numero != null ? ` nº ${result.numero}` : ""}.`
          : `Devolução processada (status: ${result.status || "—"}).`
      );
      onDone();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na devolução.";
      setError(msg);
      onError?.(msg);
    } finally {
      setBusy(false);
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
        aria-labelledby="nfe-devolucao-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2
              id="nfe-devolucao-title"
              className="text-lg font-semibold text-[#2D4C1E] dark:text-zinc-100"
            >
              Gerar devolução
            </h2>
            {header ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {header}
              </p>
            ) : null}
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
          Emite NF-e de saída (finNFe=4) referenciando a chave da compra, com
          destinatário = fornecedor.
        </p>

        {error ? <p className="admin-error mb-3">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-zinc-500">Preparando…</p>
        ) : (
          <>
            <div className="finance-table-wrap mb-4">
              <table className="finance-table finance-table--compact">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Custo</th>
                    <th>Qtd entrada</th>
                    <th>Qtd devolver</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.name}</td>
                      <td>{formatPrice(it.unitCostCents)}</td>
                      <td>
                        {it.quantity} {it.unit}
                      </td>
                      <td>
                        <input
                          className="finance-input mt-0 w-24"
                          value={qtyById[it.id] ?? ""}
                          onChange={(e) =>
                            setQtyById({ ...qtyById, [it.id]: e.target.value })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !payload}
                onClick={() => void emitir()}
              >
                {busy ? "Emitindo…" : "Emitir devolução"}
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
