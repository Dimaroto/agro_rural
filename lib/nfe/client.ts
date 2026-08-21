/** Configuração local do emissor (browser). */

export const NFE_EMISSOR_BASE_URL = "http://127.0.0.1:8001";
export const NFE_TOKEN_STORAGE_KEY = "agro_nfe_emissor_token";

type DesktopBridge = {
  isDesktop?: boolean;
  emissorBaseUrl?: string;
  isEmissorOnline?: () => Promise<boolean>;
  requestEmissor?: (opts: {
    path: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }) => Promise<{
    ok: boolean;
    status: number;
    body: string;
    error?: string;
  }>;
};

function getDesktop(): DesktopBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { agroDesktop?: DesktopBridge }).agroDesktop;
}

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

function networkErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (/failed to fetch|networkerror|load failed|fetch/i.test(msg)) {
    return (
      "Não foi possível falar com o emissor local (127.0.0.1:8001). " +
      "No app Windows: clique em «Iniciar emissor». " +
      "Se já estiver aberto, reinicie o Agro Rural para atualizar o app."
    );
  }
  return msg || "Falha de rede no emissor.";
}

/** GET/POST no emissor: via Electron (sem mixed content) ou fetch direto. */
export async function emissorHttp(input: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  baseUrl?: string;
}): Promise<{ ok: boolean; status: number; json: unknown }> {
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const method = (input.method ?? "GET").toUpperCase();
  const headers = input.headers ?? {};
  const desktop = getDesktop();

  if (desktop?.isDesktop && typeof desktop.requestEmissor === "function") {
    const proxied = await desktop.requestEmissor({
      path,
      method,
      headers,
      body: input.body,
    });
    if (proxied.status === 0) {
      throw new Error(
        proxied.error ||
          "Emissor local offline. Use «Iniciar emissor» na barra do app."
      );
    }
    let json: unknown = {};
    try {
      json = proxied.body ? JSON.parse(proxied.body) : {};
    } catch {
      json = { mensagem: proxied.body };
    }
    return { ok: proxied.ok, status: proxied.status, json };
  }

  const base = (input.baseUrl ?? NFE_EMISSOR_BASE_URL).replace(/\/$/, "");
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      mode: "cors",
      headers,
      body: input.body,
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
}

export async function checkEmissorUp(
  baseUrl = NFE_EMISSOR_BASE_URL
): Promise<boolean> {
  // No app Windows o admin roda em HTTPS; fetch para http://127.0.0.1 é
  // bloqueado (mixed content). O status vem do processo Electron.
  const desktop = getDesktop();
  if (desktop?.isDesktop && typeof desktop.isEmissorOnline === "function") {
    try {
      return !!(await desktop.isEmissorOnline());
    } catch {
      /* cai no fetch */
    }
  }

  try {
    const res = await emissorHttp({ path: "/up", baseUrl });
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
      "Configure o token do emissor (cole na emissão ou em Notas → Saída)."
    );
  }

  const path =
    input.modelo === 65
      ? "/api/v1/integracoes/agro/nfce/emitir"
      : "/api/v1/integracoes/agro/nfe/emitir";

  let res: { ok: boolean; status: number; json: unknown };
  try {
    res = await emissorHttp({
      path,
      method: "POST",
      baseUrl: input.baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.payload),
    });
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }

  const data = res.json as AgroNfeEmitResponse & {
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
