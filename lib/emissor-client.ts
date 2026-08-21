const STORAGE_KEY = "agrorural_emissor_session";

export type EmissorSession = {
  token: string;
  empresaId: number | null;
  baseUrl: string;
};

export function defaultEmissorBaseUrl(): string {
  if (typeof window !== "undefined") {
    const desktop = (
      window as Window & { agroDesktop?: { emissorBaseUrl?: string } }
    ).agroDesktop;
    if (desktop?.emissorBaseUrl) return desktop.emissorBaseUrl;
  }
  return (
    process.env.NEXT_PUBLIC_EMISSOR_URL?.trim() || "http://127.0.0.1:8001"
  );
}

export function loadEmissorSession(): EmissorSession {
  if (typeof window === "undefined") {
    return { token: "", empresaId: null, baseUrl: defaultEmissorBaseUrl() };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as EmissorSession;
      return {
        token: parsed.token ?? "",
        empresaId: parsed.empresaId ?? null,
        baseUrl: parsed.baseUrl || defaultEmissorBaseUrl(),
      };
    }
  } catch {
    /* ignore */
  }
  return { token: "", empresaId: null, baseUrl: defaultEmissorBaseUrl() };
}

export function saveEmissorSession(session: EmissorSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  if (session.token?.trim()) {
    // Mesmo token usado na emissão em Vendas
    localStorage.setItem("agro_nfe_emissor_token", session.token.trim());
  }
}

export async function emissorFetch<T>(
  path: string,
  init: RequestInit & { token?: string; baseUrl?: string } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const base = (init.baseUrl || defaultEmissorBaseUrl()).replace(/\/$/, "");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }
  const { token: _t, baseUrl: _b, ...rest } = init;
  const method = String(rest.method || "GET").toUpperCase();
  const apiPath = path.startsWith("/") ? path : `/${path}`;

  // Preferir proxy do app Windows (evita mixed content HTTPS → HTTP local)
  const { emissorHttp } = await import("@/lib/nfe/client");
  const headerObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headerObj[key] = value;
  });
  try {
    const res = await emissorHttp({
      path: apiPath,
      method,
      headers: headerObj,
      body:
        rest.body != null && method !== "GET" && method !== "HEAD"
          ? typeof rest.body === "string"
            ? rest.body
            : String(rest.body)
          : undefined,
      baseUrl: base,
    });
    return { ok: res.ok, status: res.status, data: res.json as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: {
        mensagem: err instanceof Error ? err.message : "Emissor inacessível",
      } as T,
    };
  }
}
