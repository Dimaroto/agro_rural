/** Detecta se a venda já tem NF-e autorizada (bloqueia reemissão). */

export function isOrderNfeAuthorized(input: {
  nfeStatus?: string | null;
  nfeChave?: string | null;
}): boolean {
  const status = String(input.nfeStatus ?? "")
    .toLowerCase()
    .trim();
  const chave = String(input.nfeChave ?? "").replace(/\D/g, "");
  return status === "autorizada" && chave.length === 44;
}
