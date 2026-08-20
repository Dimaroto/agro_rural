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

/**
 * Formulário de configuração fiscal — campos vazios para o usuário preencher depois.
 * Persiste no emissor Laravel quando houver sessão e empresa.
 */
export function FiscalConfigPageClient() {
  const [session, setSession] = useState<EmissorSession | null>(null);
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [ie, setIe] = useState("");
  const [cscId, setCscId] = useState("");
  const [cscToken, setCscToken] = useState("");
  const [ambiente, setAmbiente] = useState<"homologacao" | "producao">(
    "homologacao"
  );
  const [serieNfe, setSerieNfe] = useState("1");
  const [serieNfce, setSerieNfce] = useState("1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = loadEmissorSession();
    setSession(s);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.token) {
      setError("Conecte-se ao emissor na aba Fiscal antes de salvar.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        razao_social: razaoSocial || null,
        nome_fantasia: nomeFantasia || null,
        cnpj: cnpj.replace(/\D/g, "") || null,
        ie: ie || null,
        csc_id: cscId || null,
        csc_token: cscToken || null,
        ambiente,
        serie_nfe: Number(serieNfe) || 1,
        serie_nfce: Number(serieNfce) || 1,
      };

      if (!session.empresaId) {
        const created = await emissorFetch<{ id?: number; data?: { id: number }; mensagem?: string }>(
          "/api/v1/empresas",
          {
            method: "POST",
            token: session.token,
            baseUrl: session.baseUrl,
            body: JSON.stringify(payload),
          }
        );
        if (!created.ok) {
          setError(
            created.data.mensagem ||
              "Não foi possível criar a empresa. Preencha os campos obrigatórios no emissor quando estiver pronto."
          );
          return;
        }
        const id = created.data.id ?? created.data.data?.id ?? null;
        if (id) {
          const next = { ...session, empresaId: id };
          saveEmissorSession(next);
          setSession(next);
        }
        setMessage("Rascunho da empresa enviado ao emissor. Complete certificado A1 depois.");
        return;
      }

      const updated = await emissorFetch<{ mensagem?: string }>(
        `/api/v1/empresas/${session.empresaId}`,
        {
          method: "PUT",
          token: session.token,
          baseUrl: session.baseUrl,
          body: JSON.stringify(payload),
        }
      );
      if (!updated.ok) {
        setError(updated.data.mensagem || "Falha ao atualizar empresa.");
        return;
      }
      setMessage("Configurações fiscais salvas no emissor (certificado A1 ainda é separado).");
    } catch {
      setError(
        "Emissor offline (" +
          (session.baseUrl || defaultEmissorBaseUrl()) +
          ")."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/fiscal"
          className="text-sm font-medium text-[#026842] hover:underline"
        >
          ← Voltar ao Fiscal
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#026842] dark:text-zinc-100">
          Configurações fiscais
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Preencha quando tiver CNPJ, IE, CSC e certificado A1. Nada aqui é
          obrigatório agora — o fio até o emissor já está pronto.
        </p>
      </header>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      <form onSubmit={save} className="admin-card grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          Razão social
          <input
            className="admin-input mt-1 w-full px-3 py-2"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            placeholder="Preencher depois"
          />
        </label>
        <label className="text-sm">
          Nome fantasia
          <input
            className="admin-input mt-1 w-full px-3 py-2"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
          />
        </label>
        <label className="text-sm">
          CNPJ
          <input
            className="admin-input mt-1 w-full px-3 py-2"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            inputMode="numeric"
            placeholder="00.000.000/0000-00"
          />
        </label>
        <label className="text-sm">
          Inscrição estadual
          <input
            className="admin-input mt-1 w-full px-3 py-2"
            value={ie}
            onChange={(e) => setIe(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Ambiente
          <select
            className="admin-input mt-1 w-full px-3 py-2"
            value={ambiente}
            onChange={(e) =>
              setAmbiente(e.target.value as "homologacao" | "producao")
            }
          >
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
        </label>
        <label className="text-sm">
          Série NF-e
          <input
            className="admin-input mt-1 w-full px-3 py-2"
            value={serieNfe}
            onChange={(e) => setSerieNfe(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label className="text-sm">
          Série NFC-e
          <input
            className="admin-input mt-1 w-full px-3 py-2"
            value={serieNfce}
            onChange={(e) => setSerieNfce(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <label className="text-sm">
          CSC ID (NFC-e)
          <input
            className="admin-input mt-1 w-full px-3 py-2"
            value={cscId}
            onChange={(e) => setCscId(e.target.value)}
            placeholder="Preencher depois"
          />
        </label>
        <label className="text-sm">
          CSC Token (NFC-e)
          <input
            className="admin-input mt-1 w-full px-3 py-2"
            value={cscToken}
            onChange={(e) => setCscToken(e.target.value)}
            placeholder="Preencher depois"
          />
        </label>
        <p className="text-xs text-zinc-500 sm:col-span-2">
          Upload do certificado A1 (.pfx) continua pelo emissor Laravel (
          <code className="text-[11px]">POST /empresas/{"{id}"}/certificado</code>
          ) — use a interface web do emissor ou a API após ter o arquivo.
        </p>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="admin-btn-primary">
            {saving ? "Salvando…" : "Salvar no emissor"}
          </button>
        </div>
      </form>
    </div>
  );
}
