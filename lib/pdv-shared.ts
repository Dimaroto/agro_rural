import type { projectProductFields } from "./product-fields-persist";

export type PdvPaymentMethod = "pix" | "card" | "cash" | "receivable";

export const PDV_PAYMENT_LABELS: Record<PdvPaymentMethod, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  receivable: "A receber",
};

export type PdvProductListItem = {
  id: string;
  code: number;
  codeLabel: string;
  name: string;
  priceCents: number;
  available: number;
  imageUrl: string | null;
  customizationFields: ReturnType<typeof projectProductFields>;
};
