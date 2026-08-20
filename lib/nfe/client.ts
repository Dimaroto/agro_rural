/** Configuração local do emissor (browser). */

export const NFE_EMISSOR_BASE_URL = "http://127.0.0.1:8001";
export const NFE_TOKEN_STORAGE_KEY = "agro_nfe_emissor_token";

export function readNfeEmissorToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NFE_TOKEN_STORAGE_KEY)?.trim() ?? "";
}

export function writeNfeEmissorToken(token: string) {
  localStorage.setItem(NFE_TOKEN_STORAGE_KEY, token.trim());
}

export type AgroNfeEmitResponse = {
  status: string;
  chaveAcesso?: string | null;
  protocolo?: string | null;
  mensagem?: string;
  numero?: number | null;
  serie?: number | null;
  xmlUrl?: string | null;
  danfeUrl?: string | null;
  referenciaId?: string | null;
};

export async function checkEmissorUp(
  baseUrl = NFE_EMISSOR_BASE_URL
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/up`, { method: "GET", mode: "cors" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function emitNfeFromBrowser(input: {
  modelo: 55 | 65;
  payload: Record<string, unknown>;
  token?: string;
  baseUrl?: string;
}): Promise<AgroNfeEmitResponse> {
  const token = (input.token ?? readNfeEmissorToken()).trim();
  if (!token) {
    throw new Error(
      "Configure o token do emissor em Admin → Emissor."
    );
  }

  const baseUrl = input.baseUrl ?? NFE_EMISSOR_BASE_URL;
  const path =
    input.modelo === 65
      ? "/api/v1/integracoes/agro/nfce/emitir"
      : "/api/v1/integracoes/agro/nfe/emitir";

  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    mode: "cors",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.payload),
  });

  const data = (await res.json().catch(() => ({}))) as AgroNfeEmitResponse & {
    mensagem?: string;
    erros?: unknown;
  };

  if (!res.ok) {
    throw new Error(
      data.mensagem ||
        (typeof data.erros === "string" ? data.erros : null) ||
        `Falha no emissor (HTTP ${res.status}).`
    );
  }

  return data;
}
