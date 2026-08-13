export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Exibe centavos no padrão de digitação bancária (ex.: 12345 → 123,45). */
export function formatCentsBank(cents: number): string {
  return (Math.max(0, cents) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Interpreta só dígitos como centavos (digitação da direita para a esquerda). */
export function parseBankDigitsToCents(raw: string, maxDigits = 11): number {
  const digits = raw.replace(/\D/g, "").slice(0, maxDigits);
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export function getStockStatus(
  quantity: number,
  reserved: number,
  threshold: number
): StockStatus {
  const available = quantity - reserved;
  if (available <= 0) return "out_of_stock";
  if (available <= threshold) return "low_stock";
  return "in_stock";
}

export function stockLabel(status: StockStatus): string {
  switch (status) {
    case "in_stock":
      return "Disponível";
    case "low_stock":
      return "Últimas unidades";
    case "out_of_stock":
      return "Esgotado";
  }
}
