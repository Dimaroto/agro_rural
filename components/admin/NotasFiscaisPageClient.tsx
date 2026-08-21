"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatApiError } from "@/lib/apiError";
import { formatPrice } from "@/lib/format";
import {
  defaultEmissorBaseUrl,
  emissorFetch,
  loadEmissorSession,
  saveEmissorSession,
  type EmissorSession,
} from "@/lib/emissor-client";
import { downloadDanfe, downloadXml, openDanfe } from "@/lib/nfe/documents";

type Tab = "saida" | "entrada";

type NotaRow = {
  id?: number;
  chave?: string | null;
  status?: string | null;
  numero?: number | null;
  serie?: number | null;
  modelo?: number | null;
};

type EmpresaRow = {
  id: number;
  razao_social?: string | null;
  nome_fantasia?: string | null;
};

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

type PurchaseListItem = {
  id: string;
  number: string;
  series: string;
  accessKey: string;
  emitenteName: string;
  totalCents: number;
  importedAt: string;
  supplier: { name: string } | null;
  _count: { items: number; ledgerEntries: number };
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

export function NotasFiscaisPageClient() {
  const [tab, setTab] = useState<Tab>("entrada");
  const [session, setSession] = useState<EmissorSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tokenPaste, setTokenPaste] = useState("");
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [docBusyKey, setDocBusyKey] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const [chave, setChave] = useState("");
  const [xml, setXml] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [imports, setImports] = useState<PurchaseListItem[]>([]);
  const [msg, setMsg] = useState("");
  const [showProdutosLink, setShowProdutosLink] = useState(false);

  useEffect(() => {
    setSession(loadEmissorSession());
    void loadImports();
  }, []);

  useEffect(() => {
    if (!session?.token || tab !== "saida") return;
    void refreshLists(session);
  }, [session?.token, session?.empresaId, session?.baseUrl, tab]);

  async function loadImports() {
    const res = await fetch("/api/admin/nfe/purchase");
    const data = await res.json();
    if (res.ok) setImports(data.invoices ?? []);
  }

  async function refreshLists(s: EmissorSession) {
    setError("");
    try {
      const emp = await emissorFetch<{ data?: EmpresaRow[] } | EmpresaRow[]>(
        "/api/v1/empresas",
        { token: s.token, baseUrl: s.baseUrl }
      );
      if (!emp.ok) {
        setInfo(
          "Não foi possível falar com o emissor. No Windows o app inicia o Laravel em 127.0.0.1:8001."
        );
        return;
      }
      const list = Array.isArray(emp.data)
        ? emp.data
        : (emp.data as { data?: EmpresaRow[] })?.data ?? [];
      setEmpresas(list);
      const empresaId = s.empresaId ?? list[0]?.id ?? null;
      if (empresaId && empresaId !== s.empresaId) {
        const next = { ...s, empresaId };
        saveEmissorSession(next);
        setSession(next);
      }
      if (!empresaId) return;
      const nfe = await emissorFetch<{ data?: NotaRow[] } | NotaRow[]>(
        `/api/v1/empresas/${empresaId}/nfe`,
        { token: s.token, baseUrl: s.baseUrl }
      );
      if (nfe.ok) {
        const rows = Array.isArray(nfe.data)
          ? nfe.data
          : (nfe.data as { data?: NotaRow[] })?.data ?? [];
        setNotas(rows);
      }
    } catch {
      setInfo("Emissor offline.");
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const baseUrl = session?.baseUrl || defaultEmissorBaseUrl();
      const pasted = tokenPaste.trim();
      if (pasted && !email.trim()) {
        const next: EmissorSession = {
          token: pasted,
          empresaId: null,
          baseUrl,
        };
        saveEmissorSession(next);
        setSession(next);
        setTokenPaste("");
        setInfo("Token salvo. Já pode listar saídas e emitir em Vendas.");
        return;
      }
      const res = await emissorFetch<{
        token?: string;
        access_token?: string;
        mensagem?: string;
      }>("/api/v1/auth/login", {
        method: "POST",
        baseUrl,
        body: JSON.stringify({ email, password }),
      });
      const token = res.data.token || res.data.access_token;
      if (!res.ok || !token) {
        setError(res.data.mensagem || "Falha no login do emissor.");
        return;
      }
      const next: EmissorSession = { token, empresaId: null, baseUrl };
      saveEmissorSession(next);
      setSession(next);
      setPassword("");
      setTokenPaste("");
    } catch {
      setError("Emissor inacessível.");
    } finally {
      setBusy(false);
    }
  }

  async function loadLocalToken() {
    setBusy(true);
    setError("");
    try {
      const baseUrl = session?.baseUrl || defaultEmissorBaseUrl();
      const res = await fetch(
        `${baseUrl.replace(/\/$/, "")}/api/v1/integracoes/agro/token-local`,
        { headers: { Accept: "application/json" }, mode: "cors" }
      );
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        mensagem?: string;
        message?: string;
      };
      if (!res.ok || !data.token?.trim()) {
        setError(
          data.mensagem ||
            data.message ||
            "Token local não encontrado. Gere no emissor (Revisão) e cole acima."
        );
        return;
      }
      const next: EmissorSession = {
        token: data.token.trim(),
        empresaId: null,
        baseUrl,
      };
      saveEmissorSession(next);
      setSession(next);
      setInfo("Token carregado do emissor local.");
    } catch {
      setError(
        "Não foi possível ler o token do emissor. Confira se o Laravel está em 127.0.0.1:8001."
      );
    } finally {
      setBusy(false);
    }
  }

  async function onXmlFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setXml(text);
    setPreview(null);
  }

  async function downloadByKey() {
    const digits = chave.replace(/\D/g, "");
    if (digits.length !== 44) {
      setError("Informe a chave de acesso com 44 dígitos.");
      return;
    }
    if (!session?.token || !session.empresaId) {
      setError("Conecte-se ao emissor (aba Saída) para baixar por chave.");
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
        setError(res.data.mensagem || "Não foi possível baixar o XML.");
        return;
      }
      setXml(xmlContent);
      await runPreview(xmlContent);
    } catch {
      setError("Falha ao consultar o emissor.");
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
      setError(e instanceof Error ? e.message : "Erro");
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
      setError("Esta NF-e já foi importada.");
      return;
    }
    const validation = validateLines();
    if (validation) {
      setError(validation);
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
      setMsg(
        `Importada: ${data.result.itemsCreated} produto(s) novo(s), ${data.result.itemsUpdated} atualizado(s), ${data.result.lancamentosCriados} conta(s) a pagar.`
      );
      setShowProdutosLink(true);
      setPreview(null);
      setLines([]);
      setXml("");
      setChave("");
      await loadImports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <p className="text-sm text-zinc-500">Carregando…</p>;

  return (
    <div className="admin-stack space-y-6">
      <header className="finance-page-header">
        <h1 className="finance-page-header__title">Notas Fiscais</h1>
        <p className="finance-page-header__desc">
          Saídas emitidas no emissor e entradas (XML/chave) com estoque e contas a
          pagar.
        </p>
      </header>

      <div className="admin-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={tab === "entrada" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setTab("entrada")}
        >
          Entrada
        </button>
        <button
          type="button"
          role="tab"
          className={tab === "saida" ? "admin-tab admin-tab--active" : "admin-tab"}
          onClick={() => setTab("saida")}
        >
          Saída
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}
      {msg ? (
        <p className="admin-success">
          {msg}{" "}
          {showProdutosLink ? (
            <Link href="/admin/produtos" className="underline font-semibold">
              Abrir Produtos
            </Link>
          ) : null}
        </p>
      ) : null}
      {info ? <p className="admin-info">{info}</p> : null}

      {tab === "entrada" ? (
        <div className="space-y-6">
          <section className="finance-form-card space-y-3">
            <h2>Importar NF-e de compra</h2>
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
              <h2>
                Preview — NF-e {preview.nota.number}/{preview.nota.series}
              </h2>
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

          <section>
            <h2 className="text-sm font-semibold mb-2">Entradas importadas</h2>
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fornecedor</th>
                    <th>Total</th>
                    <th>Itens</th>
                    <th>Parcelas</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        {inv.number}/{inv.series}
                      </td>
                      <td>{inv.supplier?.name ?? inv.emitenteName}</td>
                      <td>{formatCents(inv.totalCents)}</td>
                      <td>{inv._count.items}</td>
                      <td>{inv._count.ledgerEntries}</td>
                    </tr>
                  ))}
                  {imports.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Nenhuma entrada importada.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            Emissão de saída continua em{" "}
            <Link href="/admin/pedidos" className="underline">
              Vendas
            </Link>
            . Aqui listamos as notas do emissor.
          </p>
          {!session.token ? (
            <form onSubmit={login} className="finance-form-card max-w-md space-y-3">
              <h2>Entrar no emissor</h2>
              <p className="text-xs text-zinc-500">
                Faça login <strong>ou</strong> cole o token Sanctum gerado no
                emissor (etapa Revisão → Gerar token). Esse token também é usado
                para emitir NF-e em Vendas.
              </p>
              <label className="block text-sm">
                URL
                <input
                  className="finance-input mt-1 w-full"
                  value={session.baseUrl}
                  onChange={(e) =>
                    setSession({ ...session, baseUrl: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                E-mail
                <input
                  type="email"
                  className="finance-input mt-1 w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Senha
                <input
                  type="password"
                  className="finance-input mt-1 w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <div className="relative py-1 text-center text-xs text-zinc-400">
                <span className="bg-[var(--admin-card-bg,#fff)] relative z-10 px-2">
                  ou cole o token
                </span>
              </div>
              <label className="block text-sm">
                Token Sanctum
                <input
                  className="finance-input mt-1 w-full font-mono text-xs"
                  placeholder="Cole o token gerado no emissor…"
                  value={tokenPaste}
                  onChange={(e) => setTokenPaste(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy || (!email.trim() && !tokenPaste.trim())}
                  className="btn btn-primary"
                >
                  {tokenPaste.trim() && !email.trim()
                    ? "Salvar token"
                    : "Conectar"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="btn"
                  onClick={() => void loadLocalToken()}
                >
                  Carregar do emissor local
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="admin-actions">
                {empresas.length > 1 ? (
                  <select
                    className="finance-input"
                    value={session.empresaId ?? ""}
                    onChange={(e) => {
                      const next = {
                        ...session,
                        empresaId: Number(e.target.value) || null,
                      };
                      saveEmissorSession(next);
                      setSession(next);
                    }}
                  >
                    {empresas.map((em) => (
                      <option key={em.id} value={em.id}>
                        {em.nome_fantasia || em.razao_social || `Empresa ${em.id}`}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className="btn"
                  onClick={() => void refreshLists(session)}
                >
                  Atualizar
                </button>
              </div>
              <ul className="space-y-2">
                {notas.map((n) => {
                  const chave = (n.chave ?? "").replace(/\D/g, "");
                  const autorizada =
                    chave.length === 44 &&
                    String(n.status ?? "")
                      .toLowerCase()
                      .includes("autoriz");
                  const rowKey = String(n.id ?? chave);
                  return (
                    <li
                      key={rowKey}
                      className="admin-card space-y-2 p-3 text-sm"
                    >
                      <p className="font-medium">
                        {n.modelo === 65 ? "NFC-e" : "NF-e"}{" "}
                        {n.numero != null
                          ? `${n.numero}/${n.serie ?? 1}`
                          : "—"}{" "}
                        · {n.status ?? "—"}
                      </p>
                      {chave ? (
                        <p className="break-all font-mono text-xs text-zinc-500">
                          {chave}
                        </p>
                      ) : null}
                      {autorizada ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn"
                            disabled={docBusyKey !== null}
                            onClick={() => {
                              setDocBusyKey(`${rowKey}-print`);
                              setError("");
                              void openDanfe(chave, session.empresaId)
                                .catch((err) =>
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Falha ao abrir DANFE."
                                  )
                                )
                                .finally(() => setDocBusyKey(null));
                            }}
                          >
                            {docBusyKey === `${rowKey}-print`
                              ? "Abrindo…"
                              : "Imprimir DANFE"}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            disabled={docBusyKey !== null}
                            onClick={() => {
                              setDocBusyKey(`${rowKey}-danfe`);
                              setError("");
                              void downloadDanfe(chave, session.empresaId)
                                .catch((err) =>
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Falha ao salvar DANFE."
                                  )
                                )
                                .finally(() => setDocBusyKey(null));
                            }}
                          >
                            {docBusyKey === `${rowKey}-danfe`
                              ? "Salvando…"
                              : "Salvar DANFE"}
                          </button>
                          <button
                            type="button"
                            className="btn"
                            disabled={docBusyKey !== null}
                            onClick={() => {
                              setDocBusyKey(`${rowKey}-xml`);
                              setError("");
                              void downloadXml(chave, session.empresaId)
                                .catch((err) =>
                                  setError(
                                    err instanceof Error
                                      ? err.message
                                      : "Falha ao salvar XML."
                                  )
                                )
                                .finally(() => setDocBusyKey(null));
                            }}
                          >
                            {docBusyKey === `${rowKey}-xml`
                              ? "Salvando…"
                              : "Salvar XML"}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
                {notas.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Nenhuma nota de saída listada.
                  </p>
                ) : null}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
