"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { formatOrderCode } from "@/lib/order-number";
import {
  defaultEmissorBaseUrl,
  emissorFetch,
  loadEmissorSession,
  saveEmissorSession,
  type EmissorSession,
} from "@/lib/emissor-client";
import { downloadDanfe, downloadXml, openDanfe } from "@/lib/nfe/documents";
import { NfeEntradaImportSheet } from "@/components/admin/NfeEntradaImportSheet";
import {
  NfeSaidaOrderPickerSheet,
  type NfeSaidaOrder,
} from "@/components/admin/NfeSaidaOrderPickerSheet";

type Tab = "saida" | "entrada";

type NotaRow = {
  id?: number;
  chave?: string | null;
  status?: string | null;
  numero?: number | null;
  serie?: number | null;
  modelo?: number | null;
  destinatarioNome?: string | null;
  pedidoNumero?: string | null;
  pedidoId?: string | null;
  /** Preenchido via lookup Neon quando o payload do emissor não tem. */
  customerName?: string | null;
  orderNumber?: number | null;
};

type EmpresaRow = {
  id: number;
  razao_social?: string | null;
  nome_fantasia?: string | null;
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
  const [tokenPaste, setTokenPaste] = useState("");
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [docBusyKey, setDocBusyKey] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [imports, setImports] = useState<PurchaseListItem[]>([]);
  const [msg, setMsg] = useState("");
  const [showProdutosLink, setShowProdutosLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);

  const loadImports = useCallback(async () => {
    const res = await fetch("/api/admin/nfe/purchase");
    const data = await res.json();
    if (res.ok) setImports(data.invoices ?? []);
  }, []);

  const refreshLists = useCallback(async (s: EmissorSession) => {
    setError("");
    setInfo("");
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
        return; // useEffect reexecuta com empresaId
      }
      if (!empresaId) {
        setNotas([]);
        setInfo("Nenhuma empresa no emissor.");
        return;
      }
      const nfe = await emissorFetch<{
        data?: NotaRow[];
        message?: string;
        mensagem?: string;
      }>(`/api/v1/empresas/${empresaId}/nfe?per_page=50`, {
        token: s.token,
        baseUrl: s.baseUrl,
      });
      if (!nfe.ok) {
        setNotas([]);
        setError(
          nfe.data.mensagem ||
            nfe.data.message ||
            `Falha ao listar notas (HTTP ${nfe.status}).`
        );
        return;
      }
      const body = nfe.data as { data?: NotaRow[] } | NotaRow[];
      let rows = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      const chaves = rows
        .map((n) => (n.chave ?? "").replace(/\D/g, ""))
        .filter((c) => c.length === 44);
      if (chaves.length > 0) {
        try {
          const metaRes = await fetch(
            `/api/admin/orders/nfe-meta?chaves=${encodeURIComponent(chaves.join(","))}`
          );
          if (metaRes.ok) {
            const meta = (await metaRes.json()) as {
              byChave?: Record<
                string,
                {
                  orderNumber: number | null;
                  customerName: string | null;
                }
              >;
            };
            const map = meta.byChave ?? {};
            rows = rows.map((n) => {
              const key = (n.chave ?? "").replace(/\D/g, "");
              const hit = map[key];
              if (!hit) return n;
              return {
                ...n,
                customerName: n.destinatarioNome || hit.customerName || n.customerName,
                orderNumber:
                  n.pedidoNumero != null && String(n.pedidoNumero).trim() !== ""
                    ? Number(n.pedidoNumero) || n.orderNumber || hit.orderNumber
                    : hit.orderNumber ?? n.orderNumber,
                destinatarioNome:
                  n.destinatarioNome || hit.customerName || n.destinatarioNome,
                pedidoNumero:
                  n.pedidoNumero ||
                  (hit.orderNumber != null ? String(hit.orderNumber) : null),
              };
            });
          }
        } catch {
          /* lista fiscal ainda funciona sem o lookup */
        }
      }

      setNotas(rows);
      if (rows.length === 0) {
        setInfo("Nenhuma nota de saída listada no emissor.");
      }
    } catch {
      setInfo("Emissor offline.");
    }
  }, []);

  const refetchActiveTab = useCallback(() => {
    if (tab === "entrada") {
      void loadImports();
      return;
    }
    const s = session ?? loadEmissorSession();
    if (s?.token) void refreshLists(s);
  }, [tab, session, loadImports, refreshLists]);

  useEffect(() => {
    setSession(loadEmissorSession());
  }, []);

  useEffect(() => {
    if (tab === "entrada") {
      void loadImports();
      return;
    }
    if (session?.token) void refreshLists(session);
  }, [tab, session?.token, session?.empresaId, session?.baseUrl, loadImports, refreshLists]);

  useEffect(() => {
    function onFocus() {
      refetchActiveTab();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") refetchActiveTab();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetchActiveTab]);

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

  function handleAlreadyEmitted(order: NfeSaidaOrder) {
    const chave = (order.nfeChave ?? "").replace(/\D/g, "");
    setError("");
    setMsg(
      `NF-e já autorizada para ${formatOrderCode(order.orderNumber, order.id)}.`
    );
    setShowProdutosLink(false);
    if (chave.length === 44 && session?.empresaId) {
      void openDanfe(chave, session.empresaId).catch((err) =>
        setError(
          err instanceof Error ? err.message : "Falha ao abrir DANFE."
        )
      );
    }
    if (session?.token) void refreshLists(session);
  }

  const q = searchQuery.trim().toLowerCase();
  const filteredImports = useMemo(() => {
    if (!q) return imports;
    return imports.filter((inv) => {
      const hay = [
        String(inv.number ?? ""),
        String(inv.series ?? ""),
        inv.supplier?.name ?? "",
        inv.emitenteName ?? "",
        inv.accessKey ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [imports, q]);

  const filteredNotas = useMemo(() => {
    if (!q) return notas;
    return notas.filter((n) => {
      const cliente = n.destinatarioNome || n.customerName || "";
      const codigo =
        n.pedidoNumero ||
        (n.orderNumber != null ? formatOrderCode(n.orderNumber) : "") ||
        "";
      const hay = [
        cliente,
        codigo,
        String(n.numero ?? ""),
        String(n.serie ?? ""),
        n.chave ?? "",
        n.status ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [notas, q]);

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

      <label className="block text-sm">
        <span className="sr-only">Pesquisar notas</span>
        <input
          type="search"
          className="finance-input w-full"
          placeholder={
            tab === "entrada"
              ? "Pesquisar por fornecedor, número ou chave…"
              : "Pesquisar por cliente, código da venda, número ou chave…"
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </label>

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
                  {filteredImports.map((inv) => (
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
                  {filteredImports.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        {q
                          ? "Nenhuma entrada corresponde à pesquisa."
                          : "Nenhuma entrada importada."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <button
            type="button"
            className="admin-fab"
            aria-label="Importar NF-e de entrada"
            onClick={() => {
              setError("");
              setMsg("");
              setShowProdutosLink(false);
              setImportSheetOpen(true);
            }}
          >
            +
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Use o botão + para emitir NF-e a partir de uma venda, ou continue em{" "}
            <Link href="/admin/pedidos" className="underline">
              Vendas
            </Link>
            .
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
                {filteredNotas.map((n) => {
                  const chave = (n.chave ?? "").replace(/\D/g, "");
                  const autorizada =
                    chave.length === 44 &&
                    String(n.status ?? "")
                      .toLowerCase()
                      .includes("autoriz");
                  const rowKey = String(n.id ?? chave);
                  const cliente =
                    n.destinatarioNome || n.customerName || null;
                  const vendaCode =
                    n.orderNumber != null && n.orderNumber > 0
                      ? formatOrderCode(n.orderNumber)
                      : n.pedidoNumero
                        ? /^\d+$/.test(String(n.pedidoNumero).trim())
                          ? formatOrderCode(Number(n.pedidoNumero))
                          : String(n.pedidoNumero)
                        : null;
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
                      {(cliente || vendaCode) ? (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          {cliente ? <span>{cliente}</span> : null}
                          {cliente && vendaCode ? " · " : null}
                          {vendaCode ? (
                            <span className="font-mono">{vendaCode}</span>
                          ) : null}
                        </p>
                      ) : null}
                      {chave ? (
                        <p className="break-all font-mono text-xs text-zinc-500">
                          {chave}
                        </p>
                      ) : null}
                      {autorizada ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-primary"
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
                {filteredNotas.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {q
                      ? "Nenhuma saída corresponde à pesquisa."
                      : "Nenhuma nota de saída listada."}
                  </p>
                ) : null}
              </ul>

              <button
                type="button"
                className="admin-fab"
                aria-label="Emitir NF-e de saída"
                onClick={() => {
                  setError("");
                  setMsg("");
                  setShowProdutosLink(false);
                  setOrderPickerOpen(true);
                }}
              >
                +
              </button>
            </>
          )}
        </div>
      )}

      <NfeEntradaImportSheet
        open={importSheetOpen}
        onClose={() => setImportSheetOpen(false)}
        session={session}
        onImported={() => void loadImports()}
        onMessage={(text, link) => {
          setMsg(text);
          setShowProdutosLink(Boolean(link));
          setError("");
        }}
        onError={(text) => {
          setError(text);
          setMsg("");
          setShowProdutosLink(false);
        }}
      />

      <NfeSaidaOrderPickerSheet
        open={orderPickerOpen}
        onClose={() => setOrderPickerOpen(false)}
        onEmitted={() => {
          if (session?.token) void refreshLists(session);
        }}
        onAlreadyEmitted={handleAlreadyEmitted}
        onMessage={(text) => {
          setMsg(text);
          setShowProdutosLink(false);
          setError("");
        }}
        onError={(text) => {
          setError(text);
          setMsg("");
          setShowProdutosLink(false);
        }}
      />
    </div>
  );
}
