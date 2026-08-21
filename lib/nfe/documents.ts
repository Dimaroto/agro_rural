import {
  defaultEmissorBaseUrl,
  loadEmissorSession,
  emissorFetch,
} from "@/lib/emissor-client";
import {
  emissorFetchBlob,
  readNfeEmissorToken,
} from "@/lib/nfe/client";

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

async function fetchNotaFile(
  kind: "danfe" | "xml",
  chave: string,
  empresaId?: number | null
): Promise<Blob> {
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
  if (!res.ok) {
    throw new Error(
      kind === "danfe"
        ? `Não foi possível gerar o DANFE (HTTP ${res.status}).`
        : `Não foi possível baixar o XML (HTTP ${res.status}).`
    );
  }
  return res.blob;
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

/** Abre o DANFE (PDF) em nova aba para visualizar/imprimir. */
export async function openDanfe(
  chave: string,
  empresaId?: number | null
): Promise<void> {
  const blob = await fetchNotaFile("danfe", chave, empresaId);
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    triggerDownload(blob, `${chave.replace(/\D/g, "")}-danfe.pdf`);
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** Salva o PDF do DANFE. */
export async function downloadDanfe(
  chave: string,
  empresaId?: number | null
): Promise<void> {
  const blob = await fetchNotaFile("danfe", chave, empresaId);
  triggerDownload(blob, `${chave.replace(/\D/g, "")}-danfe.pdf`);
}

/** Salva o XML autorizado. */
export async function downloadXml(
  chave: string,
  empresaId?: number | null
): Promise<void> {
  const blob = await fetchNotaFile("xml", chave, empresaId);
  triggerDownload(blob, `${chave.replace(/\D/g, "")}.xml`);
}
