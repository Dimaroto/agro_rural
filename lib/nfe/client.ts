/** Configuração local do emissor (browser). */

export const NFE_EMISSOR_BASE_URL = "http://127.0.0.1:8001";
export const NFE_TOKEN_STORAGE_KEY = "agro_nfe_emissor_token";

export function readNfeEmissorToken(): string {
  if (typeof window === "undefined") return "";
  const direct = localStorage.getItem(NFE_TOKEN_STORAGE_KEY)?.trim() ?? "";
  if (direct) return direct;
  // Compat: login em Notas Fiscais salva em outra chave
  try {
    const raw = localStorage.getItem("agrorural_emissor_session");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { token?: string };
    const sessionToken = parsed.token?.trim() ?? "";
    if (sessionToken) {
      localStorage.setItem(NFE_TOKEN_STORAGE_KEY, sessionToken);
      return sessionToken;
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function writeNfeEmissorToken(token: string) {
  const t = token.trim();
  localStorage.setItem(NFE_TOKEN_STORAGE_KEY, t);
  // Mantém sessão das Notas alinhada
  try {
    const raw = localStorage.getItem("agrorural_emissor_session");
    const base =
      process.env.NEXT_PUBLIC_EMISSOR_URL?.trim() || "http://127.0.0.1:8001";
    if (raw) {
      const parsed = JSON.parse(raw) as {
        token?: string;
        empresaId?: number | null;
        baseUrl?: string;
      };
      localStorage.setItem(
        "agrorural_emissor_session",
        JSON.stringify({
          token: t,
          empresaId: parsed.empresaId ?? null,
          baseUrl: parsed.baseUrl || base,
        })
      );
    } else if (t) {
      localStorage.setItem(
        "agrorural_emissor_session",
        JSON.stringify({ token: t, empresaId: null, baseUrl: base })
      );
    }
  } catch {
    /* ignore */
  }
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
  // No app Windows o admin roda em HTTPS; fetch para http://127.0.0.1 é
  // bloqueado (mixed content). O status vem do processo Electron.
  if (typeof window !== "undefined") {
    const desktop = (
      window as Window & {
        agroDesktop?: {
          isDesktop?: boolean;
          isEmissorOnline?: () => Promise<boolean>;
        };
      }
    ).agroDesktop;
    if (desktop?.isDesktop && typeof desktop.isEmissorOnline === "function") {
      try {
        return !!(await desktop.isEmissorOnline());
      } catch {
        /* cai no fetch */
      }
    }
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/up`, {
      method: "GET",
      mode: "cors",
      cache: "no-store",
    });
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
