/** Estoque operacional: UN (unidades) ou KG (gramas no banco). */

export type StockUnitCode = "UN" | "KG";

export function isStockUnit(value: unknown): value is StockUnitCode {
  return value === "UN" || value === "KG";
}

export function parseStockUnit(value: unknown): StockUnitCode {
  return value === "KG" ? "KG" : "UN";
}

/** Dígitos digitados → gramas (máscara balança 0,000 kg). Ex.: "1500" → 1500 g. */
export function parseWeightDigitsToGrams(digits: string): number {
  const cleaned = digits.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 999_999_999);
}

/** Gramas → rótulo `1,250 kg`. */
export function gramsToKgLabel(grams: number): string {
  const g = Math.max(0, Math.round(grams));
  const kg = g / 1000;
  return `${kg.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} kg`;
}

/** Dígitos → texto da máscara `0,000` (sem sufixo). */
export function formatWeightDigitsMask(digits: string): string {
  const grams = parseWeightDigitsToGrams(digits);
  return (grams / 1000).toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/** Valor em gramas → só dígitos para o input (ex.: 1250 → "1250"). */
export function gramsToWeightDigits(grams: number): string {
  const g = Math.max(0, Math.round(grams));
  return g === 0 ? "" : String(g);
}

export function formatStockQty(
  quantity: number,
  stockUnit: StockUnitCode | string | null | undefined
): string {
  if (stockUnit === "KG") return gramsToKgLabel(quantity);
  return `${Math.max(0, Math.floor(quantity))} un.`;
}

export function stockSuffix(
  available: number,
  stockUnit: StockUnitCode | string | null | undefined = "UN"
): string {
  if (available <= 0) return " — esgotado";
  if (stockUnit === "KG") return ` (${gramsToKgLabel(available)})`;
  return ` (${Math.floor(available)} un.)`;
}

/** Total em centavos: preço por kg × gramas / 1000. */
export function lineTotalCentsFromGrams(
  priceCentsPerKg: number,
  grams: number
): number {
  if (grams <= 0 || priceCentsPerKg <= 0) return 0;
  return Math.round((priceCentsPerKg * grams) / 1000);
}

export function lineTotalCents(
  priceCents: number,
  quantity: number,
  stockUnit: StockUnitCode | string | null | undefined
): number {
  if (stockUnit === "KG") {
    return lineTotalCentsFromGrams(priceCents, quantity);
  }
  return Math.round(priceCents * Math.max(0, quantity));
}
