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
    binary?: boolean;
  }) => Promise<{
    ok: boolean;
    status: number;
    body: string;
    error?: string;
    encoding?: string;
    contentType?: string;
  }>;
  openBytes?: (opts: {
    base64: string;
    filename: string;
  }) => Promise<{ ok: boolean; path?: string; error?: string }>;
  saveBytes?: (opts: {
    base64: string;
    defaultName: string;
  }) => Promise<{
    ok: boolean;
    path?: string;
    error?: string;
    canceled?: boolean;
  }>;
  onEmissorStatus?: (
    cb: (online: boolean, mode?: string) => void
  ) => void;
};

function getDesktop(): DesktopBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { agroDesktop?: DesktopBridge }).agroDesktop;
}

/** Espelho do LED da barra (onEmissorStatus) — apps desktop antigos sem isEmissorOnline. */
let cachedDesktopOnline: boolean | null = null;
let statusListenerBound = false;

function bindDesktopStatusListener() {
  if (statusListenerBound || typeof window === "undefined") return;
  const desktop = getDesktop();
  if (!desktop?.onEmissorStatus) return;
  statusListenerBound = true;
  desktop.onEmissorStatus((online) => {
    cachedDesktopOnline = !!online;
  });
}

if (typeof window !== "undefined") {
  bindDesktopStatusListener();
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

/** Baixa binário (PDF/XML) do emissor local. */
export async function emissorFetchBlob(input: {
  path: string;
  token?: string;
  baseUrl?: string;
  accept?: string;
}): Promise<{
  ok: boolean;
  status: number;
  blob: Blob;
  contentType: string;
  base64?: string;
}> {
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const token = (input.token ?? readNfeEmissorToken()).trim();
  const headers: Record<string, string> = {
    Accept: input.accept ?? "*/*",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const desktop = getDesktop();
  if (desktop?.isDesktop && typeof desktop.requestEmissor === "function") {
    const proxied = await desktop.requestEmissor({
      path,
      method: "GET",
      headers,
      binary: true,
    });
    if (proxied.status === 0) {
      throw new Error(
        proxied.error ||
          "Emissor local offline. Use «Iniciar emissor» na barra do app."
      );
    }
    const contentType =
      proxied.contentType ||
      (path.includes("/danfe") ? "application/pdf" : "application/xml");
    const base64 =
      proxied.encoding === "base64"
        ? proxied.body
        : btoa(unescape(encodeURIComponent(proxied.body)));
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return {
      ok: proxied.ok,
      status: proxied.status,
      blob: new Blob([binary], { type: contentType.split(";")[0] }),
      contentType,
      base64,
    };
  }

  const base = (input.baseUrl ?? NFE_EMISSOR_BASE_URL).replace(/\/$/, "");
  try {
    const res = await fetch(`${base}${path}`, {
      method: "GET",
      mode: "cors",
      headers,
      cache: "no-store",
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const contentType =
      res.headers.get("content-type") ||
      (path.includes("/danfe") ? "application/pdf" : "application/xml");
    return {
      ok: res.ok,
      status: res.status,
      blob: new Blob([buf], { type: contentType.split(";")[0] }),
      contentType,
      base64,
    };
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
}

export async function checkEmissorUp(
  baseUrl = NFE_EMISSOR_BASE_URL
): Promise<boolean> {
  bindDesktopStatusListener();
  const desktop = getDesktop();

  // 1) API nova do desktop
  if (desktop?.isDesktop && typeof desktop.isEmissorOnline === "function") {
    try {
      if (await desktop.isEmissorOnline()) return true;
    } catch {
      /* tenta outros meios */
    }
  }

  // 2) Espelho do LED (apps sem isEmissorOnline)
  if (desktop?.isDesktop && cachedDesktopOnline === true) {
    return true;
  }

  // 3) Probe real via proxy Electron ou fetch
  try {
    const res = await emissorHttp({ path: "/up", baseUrl });
    if (res.ok) return true;
  } catch {
    /* continue */
  }

  // 4) /up às vezes devolve HTML; API token-local prova que o Laravel responde
  if (desktop?.isDesktop && typeof desktop.requestEmissor === "function") {
    try {
      const probe = await desktop.requestEmissor({
        path: "/api/v1/integracoes/agro/token-local",
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (probe.status > 0 && probe.status < 500) return true;
    } catch {
      /* offline */
    }
  }

  if (desktop?.isDesktop && cachedDesktopOnline === false) {
    return false;
  }

  return false;
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
