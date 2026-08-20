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
  const res = await fetch(`${base}${path}`, { ...rest, headers });
  let data = {} as T;
  try {
    data = (await res.json()) as T;
  } catch {
    /* empty */
  }
  return { ok: res.ok, status: res.status, data };
}
