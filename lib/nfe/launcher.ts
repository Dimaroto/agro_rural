/** Protocolo e URLs do emissor local (admin web). */

import { NFE_EMISSOR_BASE_URL } from "@/lib/nfe/client";

export { NFE_EMISSOR_BASE_URL };
export const AGRO_EMISSOR_PROTOCOL = "agro-emissor://";

export type EmissorConfigTab =
  | "empresa"
  | "certificado"
  | "numeracao"
  | "csc"
  | "integracao";

/** Dispara o handler do instalador (start-local-hidden.vbs). */
export function launchEmissorStart(): void {
  if (typeof window === "undefined") return;
  window.location.href = `${AGRO_EMISSOR_PROTOCOL}start`;
}

export function emissorPainelUrl(tab?: EmissorConfigTab): string {
  if (!tab) return `${NFE_EMISSOR_BASE_URL}/configuracoes`;
  return `${NFE_EMISSOR_BASE_URL}/configuracoes?tab=${tab}`;
}

/** Abre o painel Laravel em nova aba (emissor precisa estar online). */
export function openEmissorConfig(tab?: EmissorConfigTab): void {
  if (typeof window === "undefined") return;
  window.open(emissorPainelUrl(tab), "_blank", "noopener,noreferrer");
}

/** Via protocolo (útil se o instalador quiser tratar deep-link). */
export function launchEmissorConfig(tab?: EmissorConfigTab): void {
  if (typeof window === "undefined") return;
  const q = tab ? `?tab=${tab}` : "";
  window.location.href = `${AGRO_EMISSOR_PROTOCOL}config${q}`;
}
