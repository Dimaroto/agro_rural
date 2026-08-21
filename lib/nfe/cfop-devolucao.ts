/** Mapeia CFOP de compra para CFOP de devolução (saída). */

export function mapCfopDevolucaoCompra(
  cfopEntrada: string | null | undefined,
  ufEmitente: string,
  ufFornecedor: string
): string {
  const digits = (cfopEntrada ?? "").replace(/\D/g, "");
  const intra =
    ufEmitente.trim().toUpperCase() === ufFornecedor.trim().toUpperCase();

  if (digits.length === 4) {
    const rest = digits.slice(1);
    // 1xxx (entrada estadual) → 5xxx; 2xxx (interestadual) → 6xxx
    if (digits.startsWith("1")) return `5${rest}`;
    if (digits.startsWith("2")) return `6${rest}`;
    if (digits.startsWith("5") || digits.startsWith("6")) return digits;
  }

  return intra ? "5202" : "6202";
}
