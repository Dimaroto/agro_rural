/** Consulta CNPJ (BrasilAPI + CNPJ.ws + OpenCNPJ), padrão Mecânica Bedendo. */

import { formatBrCep, formatBrCpfCnpj } from "@/lib/cep";

export type CnpjEmpresa = {
  cnpj: string;
  /** Preferência: nome fantasia, senão razão social. */
  nome: string;
  razaoSocial: string;
  nomeFantasia: string;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function str(value: unknown): string {
  return (value?.toString() ?? "").trim();
}

function strOrNull(value: unknown): string | null {
  const s = str(value);
  return s ? s : null;
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function titleOrNull(value: string): string | null {
  return value ? toTitleCase(value) : null;
}

function normalizeEmail(value: string): string | null {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function normalizePhone(value: string): string | null {
  const d = digitsOnly(value);
  if (d.length < 10) return null;
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

function normalizeCep(value: string): string | null {
  const d = digitsOnly(value);
  if (d.length < 8) return null;
  return formatBrCep(d.slice(0, 8));
}

function normalizeUf(value: string): string | null {
  const u = value.toUpperCase().replace(/[^A-Z]/g, "");
  if (!u) return null;
  return u.slice(0, 2);
}

function emptyPart(cnpj: string): CnpjEmpresa {
  return {
    cnpj,
    nome: "",
    razaoSocial: "",
    nomeFantasia: "",
    telefone: null,
    email: null,
    cep: null,
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    uf: null,
  };
}

function prefer(a: string | null, b: string | null): string | null {
  if (a && a.trim()) return a;
  if (b && b.trim()) return b;
  return null;
}

function merge(a: CnpjEmpresa, b: CnpjEmpresa): CnpjEmpresa {
  const razaoSocial = a.razaoSocial || b.razaoSocial;
  const nomeFantasia = a.nomeFantasia || b.nomeFantasia;
  const nome =
    a.nome ||
    b.nome ||
    (nomeFantasia || razaoSocial
      ? toTitleCase(nomeFantasia || razaoSocial)
      : "");
  return {
    cnpj: a.cnpj || b.cnpj,
    nome,
    razaoSocial,
    nomeFantasia,
    telefone: prefer(a.telefone, b.telefone),
    email: prefer(a.email, b.email),
    cep: prefer(a.cep, b.cep),
    logradouro: prefer(a.logradouro, b.logradouro),
    numero: prefer(a.numero, b.numero),
    complemento: prefer(a.complemento, b.complemento),
    bairro: prefer(a.bairro, b.bairro),
    cidade: prefer(a.cidade, b.cidade),
    uf: prefer(a.uf, b.uf),
  };
}

async function fetchJson(
  url: string,
  timeoutMs = 12_000
): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404 || !res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fromBrasilApi(digits: string): Promise<CnpjEmpresa | null> {
  const data = await fetchJson(
    `https://brasilapi.com.br/api/cnpj/v1/${digits}`
  );
  if (!data) return null;
  const fantasia = str(data.nome_fantasia);
  const razao = str(data.razao_social);
  const nome = fantasia || razao;
  return {
    ...emptyPart(digits),
    nome: nome ? toTitleCase(nome) : "",
    razaoSocial: razao,
    nomeFantasia: fantasia,
    telefone: normalizePhone(str(data.ddd_telefone_1)),
    email: normalizeEmail(str(data.email)),
    cep: normalizeCep(str(data.cep)),
    logradouro: titleOrNull(str(data.logradouro)),
    numero: strOrNull(data.numero),
    complemento: titleOrNull(str(data.complemento)),
    bairro: titleOrNull(str(data.bairro)),
    cidade: titleOrNull(str(data.municipio)),
    uf: normalizeUf(str(data.uf)),
  };
}

async function fromOpenCnpj(digits: string): Promise<CnpjEmpresa | null> {
  const data = await fetchJson(`https://api.opencnpj.org/${digits}`);
  if (!data) return null;
  const fantasia = str(data.nome_fantasia);
  const razao = str(data.razao_social);
  const nome = fantasia || razao;

  let email: string | null = null;
  const emails = data.emails;
  if (Array.isArray(emails) && emails.length > 0) {
    const first = emails[0];
    if (first && typeof first === "object") {
      const m = first as Record<string, unknown>;
      email = normalizeEmail(str(m.address ?? m.email));
    } else {
      email = normalizeEmail(str(first));
    }
  }
  email ??= normalizeEmail(str(data.email));

  let telefone: string | null = null;
  const telefones = data.telefones;
  if (Array.isArray(telefones) && telefones.length > 0) {
    const first = telefones[0];
    if (first && typeof first === "object") {
      const m = first as Record<string, unknown>;
      telefone = normalizePhone(`${str(m.ddd)}${str(m.numero)}`);
    }
  }

  return {
    ...emptyPart(digits),
    nome: nome ? toTitleCase(nome) : "",
    razaoSocial: razao,
    nomeFantasia: fantasia,
    telefone,
    email,
    cep: normalizeCep(str(data.cep)),
    logradouro: titleOrNull(str(data.logradouro)),
    numero: strOrNull(data.numero),
    complemento: titleOrNull(str(data.complemento)),
    bairro: titleOrNull(str(data.bairro)),
    cidade: titleOrNull(str(data.municipio)),
    uf: normalizeUf(str(data.uf)),
  };
}

async function fromCnpjWs(digits: string): Promise<CnpjEmpresa | null> {
  const data = await fetchJson(`https://publica.cnpj.ws/cnpj/${digits}`);
  if (!data) return null;
  const est =
    data.estabelecimento && typeof data.estabelecimento === "object"
      ? (data.estabelecimento as Record<string, unknown>)
      : {};
  const cidadeMap =
    est.cidade && typeof est.cidade === "object"
      ? (est.cidade as Record<string, unknown>)
      : null;
  const estadoMap =
    est.estado && typeof est.estado === "object"
      ? (est.estado as Record<string, unknown>)
      : null;

  const fantasia = str(est.nome_fantasia);
  const razao = str(data.razao_social);
  const nome = fantasia || razao;
  const phoneRaw = `${str(est.ddd1)}${str(est.telefone1)}`;

  return {
    ...emptyPart(digits),
    nome: nome ? toTitleCase(nome) : "",
    razaoSocial: razao,
    nomeFantasia: fantasia,
    telefone: normalizePhone(phoneRaw),
    email: normalizeEmail(str(est.email)),
    cep: normalizeCep(str(est.cep)),
    logradouro: titleOrNull(str(est.logradouro)),
    numero: strOrNull(est.numero),
    complemento: titleOrNull(str(est.complemento)),
    bairro: titleOrNull(str(est.bairro)),
    cidade: titleOrNull(str(cidadeMap?.nome)),
    uf: normalizeUf(str(estadoMap?.sigla)),
  };
}

export async function lookupCnpj(cnpj: string): Promise<CnpjEmpresa> {
  const digits = digitsOnly(cnpj);
  if (digits.length !== 14) {
    throw new Error("CNPJ deve ter 14 dígitos.");
  }

  const parts = await Promise.all([
    fromBrasilApi(digits),
    fromCnpjWs(digits),
    fromOpenCnpj(digits),
  ]);

  let merged: CnpjEmpresa | null = null;
  for (const part of parts) {
    if (!part) continue;
    merged = merged ? merge(merged, part) : part;
  }

  if (!merged) {
    throw new Error("CNPJ não encontrado.");
  }
  if (!merged.nome.trim() && !merged.razaoSocial.trim()) {
    throw new Error("CNPJ sem razão social cadastrada.");
  }
  if (!merged.nome.trim()) {
    merged = {
      ...merged,
      nome: toTitleCase(merged.nomeFantasia || merged.razaoSocial),
    };
  }
  return merged;
}

export function formatDocumentInput(value: string): string {
  return formatBrCpfCnpj(value);
}
