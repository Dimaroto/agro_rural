"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatApiError } from "@/lib/apiError";
import { formatPrice } from "@/lib/format";
import {
  emissorFetch,
  type EmissorSession,
} from "@/lib/emissor-client";

type PreviewItem = {
  index: number;
  item: {
    name: string;
    quantity: number;
    unitCostCents: number;
    totalCents: number;
    ncm: string | null;
    unit: string;
  };
  match: {
    productId: string;
    name: string;
    code: number;
    quantity: number;
  } | null;
  suggestedPriceCents: number;
  barcode: string | null;
  sku: string | null;
};

type Preview = {
  alreadyImported: boolean;
  nota: {
    accessKey: string;
    number: string;
    series: string;
    emitenteName: string;
    emitenteDoc: string;
    totalCents: number;
    warning: string | null;
  };
  supplier: { existing: boolean; name: string; document: string };
  items: PreviewItem[];
  charges: Array<{
    number: string;
    amountCents: number;
    dueDate: string | null;
    paymentMethod: string;
  }>;
};

type EditableLine = {
  index: number;
  name: string;
  barcode: string;
  quantity: string;
  unitCost: string;
  price: string;
  ncm: string;
  unit: string;
  productId: string | null;
  matchCode: number | null;
  matchName: string | null;
  matchQty: number | null;
  forceNew: boolean;
  skipStock: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  session: EmissorSession | null;
  onImported: () => void;
  onMessage?: (msg: string, showProdutosLink?: boolean) => void;
  onError?: (error: string) => void;
};

function formatCents(c: number) {
  return formatPrice(c);
}

function linesFromPreview(p: Preview): EditableLine[] {
  return p.items.map((it) => ({
    index: it.index,
    name: it.item.name,
    barcode: it.barcode ?? "",
    quantity: String(it.item.quantity),
    unitCost: (it.item.unitCostCents / 100).toFixed(2),
    price: (it.suggestedPriceCents / 100).toFixed(2),
    ncm: it.item.ncm ?? "",
    unit: it.item.unit || "UN",
    productId: it.match?.productId ?? null,
    matchCode: it.match?.code ?? null,
    matchName: it.match?.name ?? null,
    matchQty: it.match?.quantity ?? null,
    forceNew: false,
    skipStock: false,
  }));
}

export function NfeEntradaImportSheet({
  open,
  onClose,
  session,
  onImported,
  onMessage,
  onError,
}: Props) {
  const [chave, setChave] = useState("");
  const [xml, setXml] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [showProdutosLink, setShowProdutosLink] = useState(false);

  useEffect(() => {
    if (!open) return;
    setChave("");
    setXml("");
    setPreview(null);
    setLines([]);
    setDueDates({});
    setBusy(false);
    setError("");
    setMsg("");
    setShowProdutosLink(false);
  }, [open]);

  function reportError(text: string) {
    setError(text);
    onError?.(text);
  }

  async function onXmlFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setXml(text);
    setPreview(null);
    setError("");
  }

  async function downloadByKey() {
    const digits = chave.replace(/\D/g, "");
    if (digits.length !== 44) {
      reportError("Informe a chave de acesso com 44 dígitos.");
      return;
    }
    if (!session?.token || !session.empresaId) {
      reportError("Conecte-se ao emissor (aba Saída) para baixar por chave.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await emissorFetch<{
        xml?: string;
        data?: { xml?: string };
        mensagem?: string;
      }>(`/api/v1/integracoes/agro/nfe/download-por-chave`, {
        method: "POST",
        token: session.token,
        baseUrl: session.baseUrl,
        body: JSON.stringify({
          chave: digits,
          empresa_id: session.empresaId,
        }),
      });
      const xmlContent =
        res.data.xml ??
        (res.data.data as { xml?: string } | undefined)?.xml ??
        "";
      if (!res.ok || !xmlContent) {
        reportError(res.data.mensagem || "Não foi possível baixar o XML.");
        return;
      }
      setXml(xmlContent);
      await runPreview(xmlContent);
    } catch {
      reportError("Falha ao consultar o emissor.");
    } finally {
      setBusy(false);
    }
  }

  async function runPreview(xmlContent = xml) {
    setBusy(true);
    setError("");
    setMsg("");
    setShowProdutosLink(false);
    try {
      const res = await fetch("/api/admin/nfe/purchase/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml: xmlContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error) || "Preview falhou");
      const p = data.preview as Preview;
      setPreview(p);
      setLines(linesFromPreview(p));
      const dues: Record<string, string> = {};
      p.charges.forEach((c) => {
        if (c.dueDate) dues[c.number] = c.dueDate;
      });
      setDueDates(dues);
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  function updateLine(index: number, patch: Partial<EditableLine>) {
    setLines((prev) =>
      prev.map((row) => (row.index === index ? { ...row, ...patch } : row))
    );
  }

  function validateLines(): string | null {
    for (const row of lines) {
      if (row.skipStock) continue;
      if (!row.name.trim()) {
        return `Informe o nome do item na linha ${row.index + 1}.`;
      }
      const qty = Number(row.quantity.replace(",", "."));
      if (!(qty > 0)) {
        return `Quantidade inválida na linha ${row.index + 1}.`;
      }
      const cost = Number(row.unitCost.replace(",", "."));
      const price = Number(row.price.replace(",", "."));
      if (!(cost >= 0) || !(price >= 0)) {
        return `Custo/preço inválido na linha ${row.index + 1}.`;
      }
      if (row.barcode && /[^\d\s]/.test(row.barcode)) {
        return `Código de barras só pode ter dígitos (linha ${row.index + 1}).`;
      }
    }
    return null;
  }

  async function confirmImport() {
    if (!preview || !xml) return;
    if (preview.alreadyImported) {
      reportError("Esta NF-e já foi importada.");
      return;
    }
    const validation = validateLines();
    if (validation) {
      reportError(validation);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/nfe/purchase/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xml,
          itemOverrides: lines.map((row) => {
            const barcodeDigits = row.barcode.replace(/\D/g, "");
            return {
              index: row.index,
              name: row.name.trim(),
              barcode: barcodeDigits || null,
              quantity: Number(row.quantity.replace(",", ".")),
              unitCostCents: Math.round(
                Number(row.unitCost.replace(",", ".")) * 100
              ),
              priceCents: Math.round(Number(row.price.replace(",", ".")) * 100),
              ncm: row.ncm.trim() || null,
              unit: row.unit.trim() || "UN",
              productId: row.forceNew ? null : row.productId,
              forceNew: row.forceNew,
              skipStock: row.skipStock,
            };
          }),
          chargeDueDates: Object.fromEntries(
            preview.charges.map((c) => [c.number, dueDates[c.number] || null])
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error) || "Importação falhou");
      const successMsg = `Importada: ${data.result.itemsCreated} produto(s) novo(s), ${data.result.itemsUpdated} atualizado(s), ${data.result.lancamentosCriados} conta(s) a pagar.`;
      setMsg(successMsg);
      setShowProdutosLink(true);
      onMessage?.(successMsg, true);
      setPreview(null);
      setLines([]);
      setXml("");
      setChave("");
      onImported();
      onClose();
    } catch (e) {
      reportError(e instanceof Error ? e.message : "Erro");
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
        aria-labelledby="nfe-entrada-sheet-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="nfe-entrada-sheet-title" className="text-lg font-semibold text-[#2D4C1E] dark:text-zinc-100">
            Importar NF-e de compra
          </h2>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        {error ? <p className="admin-error mb-3">{error}</p> : null}
        {msg ? (
          <p className="admin-success mb-3">
            {msg}{" "}
            {showProdutosLink ? (
              <Link href="/admin/produtos" className="underline font-semibold">
                Abrir Produtos
              </Link>
            ) : null}
          </p>
        ) : null}

        <section className="finance-form-card space-y-3 mb-4">
          <label className="block text-sm">
            Arquivo XML
            <input
              type="file"
              accept=".xml,text/xml"
              className="mt-1 block w-full text-sm"
              onChange={(e) => void onXmlFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex flex-wrap gap-2 items-end">
            <label className="block text-sm flex-1 min-w-[220px]">
              Ou chave de acesso (44 dígitos)
              <input
                className="finance-input mt-1 w-full"
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder="3524…"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void downloadByKey()}
            >
              Baixar XML
            </button>
          </div>
          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !xml}
              onClick={() => void runPreview()}
            >
              Pré-visualizar
            </button>
          </div>
        </section>

        {preview ? (
          <section className="finance-form-card space-y-4">
            <h3 className="font-semibold">
              Preview — NF-e {preview.nota.number}/{preview.nota.series}
            </h3>
            {preview.alreadyImported ? (
              <p className="admin-error">Já importada anteriormente.</p>
            ) : null}
            {preview.nota.warning ? (
              <p className="admin-info">{preview.nota.warning}</p>
            ) : null}
            <p className="text-sm">
              Fornecedor:{" "}
              <strong>{preview.supplier.name}</strong> ({preview.supplier.document}) —{" "}
              {preview.supplier.existing ? "existente" : "será cadastrado"}
            </p>
            <p className="text-sm">
              Total: <strong>{formatCents(preview.nota.totalCents)}</strong>
            </p>

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Revise e ajuste os itens antes de confirmar. Eles serão cadastrados
              ou atualizados em Produtos com o estoque informado.
            </p>

            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cód. barras</th>
                    <th>Qtd</th>
                    <th>Custo</th>
                    <th>Preço venda</th>
                    <th>NCM</th>
                    <th>Vínculo</th>
                    <th>Ignorar estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((row) => (
                    <tr key={row.index} className={row.skipStock ? "opacity-60" : undefined}>
                      <td>
                        <input
                          className="finance-input min-w-[10rem]"
                          value={row.name}
                          disabled={row.skipStock}
                          onChange={(e) =>
                            updateLine(row.index, { name: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="finance-input min-w-[7rem]"
                          inputMode="numeric"
                          placeholder="—"
                          value={row.barcode}
                          disabled={row.skipStock}
                          onChange={(e) =>
                            updateLine(row.index, {
                              barcode: e.target.value.replace(/\D/g, ""),
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="finance-input w-20"
                          type="number"
                          step="any"
                          min="0"
                          value={row.quantity}
                          disabled={row.skipStock}
                          onChange={(e) =>
                            updateLine(row.index, { quantity: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="finance-input w-24"
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.unitCost}
                          disabled={row.skipStock}
                          onChange={(e) =>
                            updateLine(row.index, { unitCost: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="finance-input w-24"
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.price}
                          disabled={row.skipStock}
                          onChange={(e) =>
                            updateLine(row.index, { price: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="finance-input w-24"
                          value={row.ncm}
                          disabled={row.skipStock}
                          onChange={(e) =>
                            updateLine(row.index, {
                              ncm: e.target.value.replace(/\D/g, "").slice(0, 8),
                            })
                          }
                        />
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {row.forceNew || !row.productId ? (
                          <span className="inline-flex flex-col gap-1">
                            <span>Novo produto</span>
                            {row.productId ? (
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() =>
                                  updateLine(row.index, { forceNew: false })
                                }
                              >
                                Religar #{String(row.matchCode).padStart(4, "0")}
                              </button>
                            ) : null}
                          </span>
                        ) : (
                          <span className="inline-flex flex-col gap-1">
                            <span>
                              #{String(row.matchCode).padStart(4, "0")}
                              {row.matchQty != null ? ` · est. ${row.matchQty}` : ""}
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() =>
                                updateLine(row.index, { forceNew: true })
                              }
                            >
                              Usar como novo
                            </button>
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Ignorar estoque linha ${row.index + 1}`}
                          checked={row.skipStock}
                          onChange={(e) =>
                            updateLine(row.index, {
                              skipStock: e.target.checked,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500">
              &quot;Ignorar estoque&quot; mantém o item só no registro da nota, sem
              criar ou atualizar produto.
            </p>

            <h3 className="text-sm font-semibold">Parcelas (contas a pagar)</h3>
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th>Forma</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.charges.map((c) => (
                    <tr key={c.number}>
                      <td>{c.number}</td>
                      <td>{formatCents(c.amountCents)}</td>
                      <td>
                        <input
                          type="date"
                          className="finance-input"
                          value={dueDates[c.number] ?? ""}
                          onChange={(e) =>
                            setDueDates({ ...dueDates, [c.number]: e.target.value })
                          }
                        />
                      </td>
                      <td>{c.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || preview.alreadyImported}
              onClick={() => void confirmImport()}
            >
              Confirmar importação
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
