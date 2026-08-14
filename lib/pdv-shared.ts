import type { projectProductFields } from "./product-fields-persist";

export type PdvPaymentMethod = "pix" | "card" | "cash" | "receivable";

export const PDV_PAYMENT_LABELS: Record<PdvPaymentMethod, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  receivable: "A prazo",
};

export type PdvProductListItem = {
  id: string;
  code: number;
  codeLabel: string;
  barcode: string | null;
  name: string;
  categoryName: string;
  categorySlug: string;
  priceCents: number;
  available: number;
  imageUrl: string | null;
  customizationFields: ReturnType<typeof projectProductFields>;
};

export type PdvCartLine = {
  productId: string;
  quantity: number;
};

export type PdvCustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  isBirthday: boolean;
  openBalanceCents: number;
};
