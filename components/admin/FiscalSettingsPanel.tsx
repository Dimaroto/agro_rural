"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readNfeEmissorToken,
  writeNfeEmissorToken,
} from "@/lib/nfe/client";
import {
  fetchLocalToken,
  getEmpresa,
  listEmpresas,
  loginEmissor,
  updateEmpresa,
  updateNumeracao,
  uploadCertificadoA1,
  type EmissorEmpresa,
} from "@/lib/nfe/fiscal-api";
import { openEmissorConfig } from "@/lib/nfe/launcher";

type FiscalSettingsPanelProps = {
  online: boolean;
  onTokenChange?: (token: string) => void;
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function numOf(
  empresa: EmissorEmpresa | null,
  modelo: 55 | 65
): { serie: string; proximo: string } {
  const row = empresa?.numeracoes?.find((n) => n.modelo === modelo);
  return {
    serie: String(row?.serie ?? (modelo === 55 ? 1 : 1)),
    proximo: String(row?.proximo_numero ?? 1),
  };
}

export function FiscalSettingsPanel({
  online,
  onTokenChange,
}: FiscalSettingsPanelProps) {
  const [token, setToken] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [empresas, setEmpresas] = useState<EmissorEmpresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [ambiente, setAmbiente] = useState<"homologacao" | "producao">(
    "homologacao"
  );
  const [razao, setRazao] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [ie, setIe] = useState("");
  const [im, setIm] = useState("");
  const [crt, setCrt] = useState(1);
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [codigoMunicipio, setCodigoMunicipio] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState("");
  const [serie55, setSerie55] = useState("1");
  const [proximo55, setProximo55] = useState("1");
  const [serie65, setSerie65] = useState("1");
  const [proximo65, setProximo65] = useState("1");
  const [cscId, setCscId] = useState("");
  const [cscToken, setCscToken] = useState("");
  const [certMeta, setCertMeta] = useState("");
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxSenha, setPfxSenha] = useState("");

  const fill = useCallback((e: EmissorEmpresa) => {
    setEmpresaId(e.id);
    setAmbiente(e.ambiente === "producao" ? "producao" : "homologacao");
    setRazao(e.razao_social ?? "");
    setFantasia(e.nome_fantasia ?? "");
    setCnpj(e.cnpj ?? "");
    setIe(e.ie ?? "");
    setIm(e.inscricao_municipal ?? "");
    setCrt(e.crt ?? 1);
    setLogradouro(e.logradouro ?? "");
    setNumero(e.numero ?? "");
    setComplemento(e.complemento ?? "");
    setBairro(e.bairro ?? "");
    setMunicipio(e.municipio ?? "");
    setCodigoMunicipio(e.codigo_municipio ?? "");
    setUf(e.uf ?? "");
    setCep(e.cep ?? "");
    setCscId(e.csc_id ?? "");
    setCscToken(e.csc_token ?? "");
    const n55 = numOf(e, 55);
    const n65 = numOf(e, 65);
    setSerie55(n55.serie);
    setProximo55(n55.proximo);
    setSerie65(n65.serie);
    setProximo65(n65.proximo);
    if (e.certificado) {
      const bits = [
        e.certificado.cnpj ? `CNPJ ${e.certificado.cnpj}` : null,
        e.certificado.validade ? `val. ${e.certificado.validade}` : null,
        e.certificado.subject,
      ].filter(Boolean);
      setCertMeta(bits.join(" · ") || "Certificado instalado");
    } else {
      setCertMeta("Nenhum certificado A1");
    }
  }, []);

  const reload = useCallback(async () => {
    if (!online || !readNfeEmissorToken()) return;
    setLoading(true);
    setError("");
    try {
      const list = await listEmpresas();
      setEmpresas(list);
      const first = list[0];
      if (!first) {
        setError("Nenhuma empresa no emissor. Cadastre no painel local.");
        return;
      }
      const full = await getEmpresa(first.id);
      fill(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar empresa.");
    } finally {
      setLoading(false);
    }
  }, [online, fill]);

  useEffect(() => {
    setToken(readNfeEmissorToken());
  }, []);

  useEffect(() => {
    if (online && token) {
      void reload();
    }
  }, [online, token, reload]);

  function persistToken(value: string) {
    writeNfeEmissorToken(value);
    setToken(value);
    onTokenChange?.(value);
  }

  async function onLoadLocalToken() {
    setError("");
    setMsg("");
    try {
      const t = await fetchLocalToken();
      persistToken(t);
      setMsg("Token carregado do emissor local.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler o token.");
    }
  }

  async function onLogin() {
    setError("");
    setMsg("");
    try {
      const t = await loginEmissor({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      persistToken(t);
      setLoginPassword("");
      setMsg("Login OK — token salvo neste navegador.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no login.");
    }
  }

  async function onSaveAll() {
    if (!empresaId) return;
    setSaving(true);
    setError("");
    setMsg("");
    try {
      await updateEmpresa(empresaId, {
        ambiente,
        razao_social: razao.trim(),
        nome_fantasia: fantasia.trim() || null,
        cnpj: digitsOnly(cnpj),
        ie: ie.trim() || null,
        inscricao_municipal: im.trim() || null,
        crt,
        logradouro: logradouro.trim(),
        numero: numero.trim(),
        complemento: complemento.trim() || null,
        bairro: bairro.trim(),
        municipio: municipio.trim(),
        codigo_municipio: digitsOnly(codigoMunicipio),
        uf: uf.trim().toUpperCase(),
        cep: digitsOnly(cep),
        csc_id: cscId.trim() || null,
        csc_token: cscToken.trim() || null,
      });
      const updated = await updateNumeracao(empresaId, {
        serie_55: Number(serie55) || 1,
        proximo_55: Number(proximo55) || 1,
        serie_65: Number(serie65) || 1,
        proximo_65: Number(proximo65) || 1,
      });
      fill(updated);
      setMsg("Configuração fiscal salva no emissor.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function onUploadCert() {
    if (!empresaId || !pfxFile) {
      setError("Selecione o arquivo .pfx e a senha.");
      return;
    }
    setSaving(true);
    setError("");
    setMsg("");
    try {
      await uploadCertificadoA1({
        empresaId,
        file: pfxFile,
        senha: pfxSenha,
      });
      setPfxFile(null);
      setPfxSenha("");
      setMsg("Certificado A1 enviado.");
      const full = await getEmpresa(empresaId);
      fill(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload do certificado.");
    } finally {
      setSaving(false);
    }
  }

  const disabled = !online || !token || !empresaId || saving;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Fiscal / NF-e
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Dados gravados no emissor local (Neon schema emissor). Token fica só
            neste navegador.
          </p>
        </div>
        <button
          type="button"
          disabled={!online}
          onClick={() => openEmissorConfig()}
          className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Abrir painel Laravel
        </button>
      </div>

      {!online && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Emissor offline. Use <strong>Iniciar emissor</strong> acima; salvar e
          certificado ficam desabilitados.
        </p>
      )}

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Token API
        </p>
        <input
          type="password"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setMsg("");
          }}
          placeholder="Cole o token Sanctum (agro-app)"
          className="admin-input w-full py-2 font-mono text-xs"
          autoComplete="off"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              persistToken(token);
              setMsg("Token salvo neste navegador.");
            }}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Salvar token
          </button>
          <button
            type="button"
            disabled={!online}
            onClick={() => void onLoadLocalToken()}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Carregar do emissor local
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            placeholder="E-mail do painel local"
            className="admin-input py-2 text-xs"
            disabled={!online}
          />
          <input
            type="password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            placeholder="Senha"
            className="admin-input py-2 text-xs"
            disabled={!online}
            autoComplete="current-password"
          />
        </div>
        <button
          type="button"
          disabled={!online || !loginEmail || !loginPassword}
          onClick={() => void onLogin()}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Entrar e obter token
        </button>
      </section>

      {loading && (
        <p className="text-xs text-zinc-500">Carregando empresa…</p>
      )}

      {empresas.length > 1 && (
        <label className="block text-xs text-zinc-500">
          Empresa
          <select
            className="admin-input mt-1 w-full py-2 text-sm"
            value={empresaId ?? ""}
            disabled={!online}
            onChange={(e) => {
              const id = Number(e.target.value);
              void getEmpresa(id).then(fill).catch((err) => {
                setError(err instanceof Error ? err.message : "Erro");
              });
            }}
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                #{e.id} — {e.razao_social}
              </option>
            ))}
          </select>
        </label>
      )}

      <section className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-zinc-500 sm:col-span-2">
          Ambiente SEFAZ
          <select
            className="admin-input mt-1 w-full py-2 text-sm"
            value={ambiente}
            disabled={disabled}
            onChange={(e) =>
              setAmbiente(e.target.value as "homologacao" | "producao")
            }
          >
            <option value="homologacao">Homologação</option>
            <option value="producao">Produção</option>
          </select>
        </label>
        <Field label="Razão social" value={razao} onChange={setRazao} disabled={disabled} className="sm:col-span-2" />
        <Field label="Nome fantasia" value={fantasia} onChange={setFantasia} disabled={disabled} />
        <Field label="CNPJ" value={cnpj} onChange={setCnpj} disabled={disabled} />
        <Field label="IE" value={ie} onChange={setIe} disabled={disabled} />
        <Field label="IM" value={im} onChange={setIm} disabled={disabled} />
        <label className="text-xs text-zinc-500">
          CRT
          <select
            className="admin-input mt-1 w-full py-2 text-sm"
            value={crt}
            disabled={disabled}
            onChange={(e) => setCrt(Number(e.target.value))}
          >
            <option value={1}>1 — Simples Nacional</option>
            <option value={2}>2 — Simples excesso</option>
            <option value={3}>3 — Regime Normal</option>
          </select>
        </label>
        <Field label="Logradouro" value={logradouro} onChange={setLogradouro} disabled={disabled} className="sm:col-span-2" />
        <Field label="Número" value={numero} onChange={setNumero} disabled={disabled} />
        <Field label="Complemento" value={complemento} onChange={setComplemento} disabled={disabled} />
        <Field label="Bairro" value={bairro} onChange={setBairro} disabled={disabled} />
        <Field label="Município" value={municipio} onChange={setMunicipio} disabled={disabled} />
        <Field label="Cód. IBGE" value={codigoMunicipio} onChange={setCodigoMunicipio} disabled={disabled} />
        <Field label="UF" value={uf} onChange={setUf} disabled={disabled} />
        <Field label="CEP" value={cep} onChange={setCep} disabled={disabled} />
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
          Numeração
        </p>
        <Field label="Série NF-e (55)" value={serie55} onChange={setSerie55} disabled={disabled} />
        <Field label="Próximo nº 55" value={proximo55} onChange={setProximo55} disabled={disabled} />
        <Field label="Série NFC-e (65)" value={serie65} onChange={setSerie65} disabled={disabled} />
        <Field label="Próximo nº 65" value={proximo65} onChange={setProximo65} disabled={disabled} />
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:col-span-2">
          CSC (NFC-e)
        </p>
        <Field label="CSC ID" value={cscId} onChange={setCscId} disabled={disabled} />
        <Field label="CSC Token" value={cscToken} onChange={setCscToken} disabled={disabled} />
      </section>

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Certificado A1
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{certMeta}</p>
        <input
          type="file"
          accept=".pfx,.p12"
          disabled={disabled}
          onChange={(e) => setPfxFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs dark:text-zinc-300 dark:file:bg-zinc-800"
        />
        <input
          type="password"
          value={pfxSenha}
          onChange={(e) => setPfxSenha(e.target.value)}
          placeholder="Senha do .pfx"
          disabled={disabled}
          className="admin-input w-full py-2 text-xs"
          autoComplete="off"
        />
        <button
          type="button"
          disabled={disabled || !pfxFile || !pfxSenha}
          onClick={() => void onUploadCert()}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Enviar certificado
        </button>
      </section>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {msg && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{msg}</p>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => void onSaveAll()}
        className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar configuração fiscal"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={`text-xs text-zinc-500 ${className}`}>
      {label}
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="admin-input mt-1 w-full py-2 text-sm"
      />
    </label>
  );
}
