import {
  defaultEmissorBaseUrl,
  loadEmissorSession,
  emissorFetch,
} from "@/lib/emissor-client";
import {
  emissorFetchBlob,
  readNfeEmissorToken,
} from "@/lib/nfe/client";

type DesktopDocs = {
  isDesktop?: boolean;
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
};

function getDesktop(): DesktopDocs | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { agroDesktop?: DesktopDocs }).agroDesktop;
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([binary], { type });
}

function assertPdfBase64(base64: string) {
  try {
    const head = atob(base64.slice(0, 32));
    if (!head.startsWith("%PDF")) {
      throw new Error(
        "O DANFE veio vazio ou inválido. Confira se a nota está autorizada no emissor."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("DANFE")) throw e;
    throw new Error("Não foi possível ler o PDF do DANFE.");
  }
}

async function resolveEmpresaId(
  empresaId?: number | null
): Promise<number> {
  if (empresaId && empresaId > 0) return empresaId;
  const session = loadEmissorSession();
  if (session.empresaId) return session.empresaId;
  const token = session.token || readNfeEmissorToken();
  if (!token) {
    throw new Error(
      "Conecte-se ao emissor em Notas Fiscais → Saída para abrir o DANFE."
    );
  }
  const res = await emissorFetch<
    { data?: Array<{ id: number }> } | Array<{ id: number }>
  >("/api/v1/empresas", {
    token,
    baseUrl: session.baseUrl || defaultEmissorBaseUrl(),
  });
  const list = Array.isArray(res.data)
    ? res.data
    : (res.data as { data?: Array<{ id: number }> })?.data ?? [];
  const id = list[0]?.id;
  if (!id) throw new Error("Nenhuma empresa no emissor.");
  return id;
}

async function fetchNotaBase64(
  kind: "danfe" | "xml",
  chave: string,
  empresaId?: number | null
): Promise<{ base64: string; filename: string; mime: string }> {
  const digits = chave.replace(/\D/g, "");
  if (digits.length !== 44) {
    throw new Error("Chave de acesso inválida.");
  }
  const empId = await resolveEmpresaId(empresaId);
  const path = `/api/v1/empresas/${empId}/nfe/${digits}/${kind}`;
  const res = await emissorFetchBlob({
    path,
    accept: kind === "danfe" ? "application/pdf" : "application/xml",
  });
  if (!res.ok || !res.base64) {
    throw new Error(
      kind === "danfe"
        ? `Não foi possível gerar o DANFE (HTTP ${res.status}).`
        : `Não foi possível baixar o XML (HTTP ${res.status}).`
    );
  }
  if (kind === "danfe") assertPdfBase64(res.base64);
  return {
    base64: res.base64,
    filename: kind === "danfe" ? `${digits}-danfe.pdf` : `${digits}.xml`,
    mime: kind === "danfe" ? "application/pdf" : "application/xml",
  };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Abre o DANFE no leitor de PDF do Windows (sem link blob:). */
export async function openDanfe(
  chave: string,
  empresaId?: number | null
): Promise<void> {
  const file = await fetchNotaBase64("danfe", chave, empresaId);
  const desktop = getDesktop();
  if (desktop?.isDesktop && typeof desktop.openBytes === "function") {
    const result = await desktop.openBytes({
      base64: file.base64,
      filename: file.filename,
    });
    if (!result.ok) {
      throw new Error(result.error || "Não foi possível abrir o DANFE.");
    }
    return;
  }
  // Navegador: só download — evita diálogo “abrir link blob”
  triggerDownload(base64ToBlob(file.base64, file.mime), file.filename);
}

/** Salva o PDF do DANFE. */
export async function downloadDanfe(
  chave: string,
  empresaId?: number | null
): Promise<void> {
  const file = await fetchNotaBase64("danfe", chave, empresaId);
  const desktop = getDesktop();
  if (desktop?.isDesktop && typeof desktop.saveBytes === "function") {
    const result = await desktop.saveBytes({
      base64: file.base64,
      defaultName: file.filename,
    });
    if (result.canceled) return;
    if (!result.ok) {
      throw new Error(result.error || "Não foi possível salvar o DANFE.");
    }
    return;
  }
  triggerDownload(base64ToBlob(file.base64, file.mime), file.filename);
}

/** Salva o XML autorizado. */
export async function downloadXml(
  chave: string,
  empresaId?: number | null
): Promise<void> {
  const file = await fetchNotaBase64("xml", chave, empresaId);
  const desktop = getDesktop();
  if (desktop?.isDesktop && typeof desktop.saveBytes === "function") {
    const result = await desktop.saveBytes({
      base64: file.base64,
      defaultName: file.filename,
    });
    if (result.canceled) return;
    if (!result.ok) {
      throw new Error(result.error || "Não foi possível salvar o XML.");
    }
    return;
  }
  triggerDownload(base64ToBlob(file.base64, file.mime), file.filename);
}
