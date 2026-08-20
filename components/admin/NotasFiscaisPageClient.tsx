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
  item: { name: string; quantity: number; unitCostCents: number; totalCents: number };
  match: { productId: string; name: string; code: number; quantity: number } | null;
  suggestedPriceCents: number;
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

export function NotasFiscaisPageClient() {
  const [tab, setTab] = useState<Tab>("entrada");
  const [session, setSession] = useState<EmissorSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const [chave, setChave] = useState("");
  const [xml, setXml] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [imports, setImports] = useState<PurchaseListItem[]>([]);
  const [msg, setMsg] = useState("");

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
    } catch {
      setError("Emissor inacessível.");
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
      const priceMap: Record<number, number> = {};
      p.items.forEach((it) => {
        priceMap[it.index] = it.suggestedPriceCents;
      });
      setPrices(priceMap);
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

  async function confirmImport() {
    if (!preview || !xml) return;
    if (preview.alreadyImported) {
      setError("Esta NF-e já foi importada.");
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
          itemOverrides: preview.items.map((it) => ({
            index: it.index,
            priceCents: prices[it.index] ?? it.suggestedPriceCents,
            productId: it.match?.productId ?? null,
          })),
          chargeDueDates: Object.fromEntries(
            preview.charges.map((c) => [c.number, dueDates[c.number] || null])
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data.error) || "Importação falhou");
      setMsg(
        `Importada: ${data.result.itemsCreated} produtos novos, ${data.result.itemsUpdated} atualizados, ${data.result.lancamentosCriados} contas a pagar.`
      );
      setPreview(null);
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
      {msg ? <p className="admin-success">{msg}</p> : null}
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

              <div className="finance-table-wrap">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Qtd</th>
                      <th>Custo</th>
                      <th>Match</th>
                      <th>Preço venda (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((it) => (
                      <tr key={it.index}>
                        <td>{it.item.name}</td>
                        <td>{it.item.quantity}</td>
                        <td>{formatCents(it.item.unitCostCents)}</td>
                        <td>
                          {it.match
                            ? `#${String(it.match.code).padStart(4, "0")} (est. ${it.match.quantity})`
                            : "Novo"}
                        </td>
                        <td>
                          <input
                            className="finance-input"
                            type="number"
                            step="0.01"
                            min="0"
                            value={((prices[it.index] ?? it.suggestedPriceCents) / 100).toFixed(2)}
                            onChange={(e) =>
                              setPrices({
                                ...prices,
                                [it.index]: Math.round(Number(e.target.value) * 100),
                              })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                  required
                  className="finance-input mt-1 w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Senha
                <input
                  type="password"
                  required
                  className="finance-input mt-1 w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button type="submit" disabled={busy} className="btn btn-primary">
                Conectar
              </button>
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
                {notas.map((n) => (
                  <li key={n.id ?? n.chave ?? Math.random()} className="admin-card p-3 text-sm">
                    <p className="font-medium">
                      {n.modelo === 65 ? "NFC-e" : "NF-e"}{" "}
                      {n.numero != null ? `${n.numero}/${n.serie ?? 1}` : "—"} ·{" "}
                      {n.status ?? "—"}
                    </p>
                    {n.chave ? (
                      <p className="mt-1 break-all text-xs text-zinc-500">{n.chave}</p>
                    ) : null}
                  </li>
                ))}
                {notas.length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhuma nota de saída listada.</p>
                ) : null}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
