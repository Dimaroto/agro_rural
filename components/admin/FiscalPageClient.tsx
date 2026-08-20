"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  defaultEmissorBaseUrl,
  emissorFetch,
  loadEmissorSession,
  saveEmissorSession,
  type EmissorSession,
} from "@/lib/emissor-client";

type NotaRow = {
  id?: number;
  chave?: string | null;
  status?: string | null;
  numero?: number | null;
  serie?: number | null;
  modelo?: number | null;
  created_at?: string;
};

type EmpresaRow = {
  id: number;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
};

export function FiscalPageClient() {
  const [session, setSession] = useState<EmissorSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notas, setNotas] = useState<NotaRow[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSession(loadEmissorSession());
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    void refreshLists(session);
  }, [session?.token, session?.empresaId, session?.baseUrl]);

  async function refreshLists(s: EmissorSession) {
    setError("");
    try {
      const emp = await emissorFetch<{ data?: EmpresaRow[] } | EmpresaRow[]>(
        "/api/v1/empresas",
        { token: s.token, baseUrl: s.baseUrl }
      );
      if (!emp.ok) {
        setInfo(
          "Não foi possível falar com o emissor. No Windows o app inicia o Laravel em 127.0.0.1:8001; no Android configure NEXT_PUBLIC_EMISSOR_URL."
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
      setInfo(
        "Emissor offline. Abra o AgroRural Admin no Windows (sidecar PHP) ou defina a URL do serviço."
      );
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
      const next: EmissorSession = {
        token,
        empresaId: null,
        baseUrl,
      };
      saveEmissorSession(next);
      setSession(next);
      setPassword("");
    } catch {
      setError("Emissor inacessível em " + (session?.baseUrl || defaultEmissorBaseUrl()));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("agrorural_emissor_session");
    setSession({ token: "", empresaId: null, baseUrl: defaultEmissorBaseUrl() });
    setNotas([]);
    setEmpresas([]);
  }

  if (!session) {
    return <p className="text-sm text-zinc-500">Carregando…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#026842] dark:text-zinc-100">
            Fiscal / Notas
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Emissor NF-e embutido (Windows) ou remoto. Configurações fiscais você
            preenche depois.
          </p>
        </div>
        <Link href="/admin/fiscal/configuracoes" className="admin-btn-secondary">
          Configurações fiscais
        </Link>
      </header>

      {info && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {info}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!session.token ? (
        <form onSubmit={login} className="admin-card max-w-md space-y-3 p-4">
          <h2 className="text-sm font-semibold">Entrar no emissor</h2>
          <label className="block text-sm">
            URL do emissor
            <input
              className="admin-input mt-1 w-full px-3 py-2"
              value={session.baseUrl}
              onChange={(e) =>
                setSession({ ...session, baseUrl: e.target.value })
              }
              placeholder="http://127.0.0.1:8001"
            />
          </label>
          <label className="block text-sm">
            E-mail
            <input
              type="email"
              required
              className="admin-input mt-1 w-full px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Senha
            <input
              type="password"
              required
              className="admin-input mt-1 w-full px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy} className="admin-btn-primary">
            {busy ? "Conectando…" : "Conectar"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="admin-card flex flex-wrap items-center gap-3 p-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Conectado · {session.baseUrl}
              {session.empresaId != null && ` · empresa #${session.empresaId}`}
            </p>
            {empresas.length > 1 && (
              <select
                className="admin-input px-2 py-1 text-sm"
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
            )}
            <button type="button" className="admin-btn-ghost ml-auto" onClick={logout}>
              Sair do emissor
            </button>
            <button
              type="button"
              className="admin-btn-secondary"
              onClick={() => void refreshLists(session)}
            >
              Atualizar
            </button>
          </div>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              Notas recentes
            </h2>
            {notas.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Nenhuma nota ainda. Após configurar o certificado, emita a partir
                das vendas (adaptador{" "}
                <code className="text-xs">/integracoes/agrorural</code>).
              </p>
            ) : (
              <ul className="space-y-2">
                {notas.map((n) => (
                  <li key={n.id ?? n.chave ?? Math.random()} className="admin-card p-3 text-sm">
                    <p className="font-medium">
                      {n.modelo === 65 ? "NFC-e" : "NF-e"}{" "}
                      {n.numero != null ? `${n.numero}/${n.serie ?? 1}` : "—"} ·{" "}
                      {n.status ?? "—"}
                    </p>
                    {n.chave && (
                      <p className="mt-1 break-all text-xs text-zinc-500">{n.chave}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
