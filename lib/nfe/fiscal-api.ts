/** Chamadas do admin web → API local do emissor (127.0.0.1:8001). */

import {
  NFE_EMISSOR_BASE_URL,
  readNfeEmissorToken,
  writeNfeEmissorToken,
} from "@/lib/nfe/client";

export type EmissorEmpresa = {
  id: number;
  cnpj: string;
  ie: string | null;
  inscricao_municipal: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  email: string | null;
  telefone: string | null;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  municipio: string;
  codigo_municipio: string;
  uf: string;
  cep: string;
  crt: number;
  ambiente: "homologacao" | "producao";
  csc_id: string | null;
  csc_token: string | null;
  ativa: boolean;
  certificado: {
    validade?: string;
    cnpj?: string;
    subject?: string;
  } | null;
  numeracoes:
    | Array<{
        modelo: number;
        serie: number;
        proximo_numero: number;
      }>
    | null;
};

function authHeaders(token?: string): HeadersInit {
  const t = (token ?? readNfeEmissorToken()).trim();
  if (!t) {
    throw new Error("Token do emissor não configurado.");
  }
  return {
    Authorization: `Bearer ${t}`,
    Accept: "application/json",
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    mensagem?: string;
    errors?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      data.mensagem ||
        data.message ||
        `Falha no emissor (HTTP ${res.status}).`
    );
  }
  return data;
}

export async function fetchLocalToken(
  baseUrl = NFE_EMISSOR_BASE_URL
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/v1/integracoes/agro/token-local`, {
    method: "GET",
    mode: "cors",
    headers: { Accept: "application/json" },
  });
  const data = await parseJson<{ token: string }>(res);
  writeNfeEmissorToken(data.token);
  return data.token;
}

export async function loginEmissor(input: {
  email: string;
  password: string;
  baseUrl?: string;
}): Promise<string> {
  const baseUrl = input.baseUrl ?? NFE_EMISSOR_BASE_URL;
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    mode: "cors",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      device_name: "agro-admin-web",
    }),
  });
  const data = await parseJson<{ token: string }>(res);
  writeNfeEmissorToken(data.token);
  return data.token;
}

export async function listEmpresas(
  baseUrl = NFE_EMISSOR_BASE_URL
): Promise<EmissorEmpresa[]> {
  const res = await fetch(`${baseUrl}/api/v1/empresas`, {
    method: "GET",
    mode: "cors",
    headers: authHeaders(),
  });
  const data = await parseJson<{ data: EmissorEmpresa[] }>(res);
  return data.data ?? [];
}

export async function getEmpresa(
  id: number,
  baseUrl = NFE_EMISSOR_BASE_URL
): Promise<EmissorEmpresa> {
  const res = await fetch(`${baseUrl}/api/v1/empresas/${id}`, {
    method: "GET",
    mode: "cors",
    headers: authHeaders(),
  });
  const data = await parseJson<{ data: EmissorEmpresa }>(res);
  return data.data;
}

export async function updateEmpresa(
  id: number,
  body: Record<string, unknown>,
  baseUrl = NFE_EMISSOR_BASE_URL
): Promise<EmissorEmpresa> {
  const res = await fetch(`${baseUrl}/api/v1/empresas/${id}`, {
    method: "PUT",
    mode: "cors",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ data: EmissorEmpresa }>(res);
  return data.data;
}

export async function updateNumeracao(
  id: number,
  body: {
    serie_55: number;
    proximo_55: number;
    serie_65: number;
    proximo_65: number;
  },
  baseUrl = NFE_EMISSOR_BASE_URL
): Promise<EmissorEmpresa> {
  const res = await fetch(`${baseUrl}/api/v1/empresas/${id}/numeracao`, {
    method: "PUT",
    mode: "cors",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ data: EmissorEmpresa }>(res);
  return data.data;
}

export async function uploadCertificadoA1(input: {
  empresaId: number;
  file: File;
  senha: string;
  baseUrl?: string;
}): Promise<void> {
  const baseUrl = input.baseUrl ?? NFE_EMISSOR_BASE_URL;
  const form = new FormData();
  form.append("pfx", input.file);
  form.append("senha", input.senha);

  const res = await fetch(
    `${baseUrl}/api/v1/empresas/${input.empresaId}/certificado`,
    {
      method: "POST",
      mode: "cors",
      headers: authHeaders(),
      body: form,
    }
  );
  await parseJson(res);
}
