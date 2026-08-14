/** Normaliza código de barras para só dígitos. Vazio vira null. */
export function normalizeBarcode(value: string | null | undefined): string | null {
  if (value == null) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

export function isValidBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value);
}
