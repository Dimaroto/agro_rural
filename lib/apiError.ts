type ZodFlattenError = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  description: "Descrição",
  priceCents: "Preço",
  price: "Preço",
  categoryId: "Categoria",
  imageUrl: "Imagem",
  quantity: "Quantidade",
  active: "Status",
  whatsapp: "WhatsApp",
  bannerUrl: "Banner (computador)",
  bannerUrlMobile: "Banner (celular)",
  label: "Rótulo",
  type: "Tipo",
};

export function formatApiError(
  error: unknown,
  fallback = "Ocorreu um erro"
): string {
  if (typeof error === "string" && error.trim()) return error;
  if (!error || typeof error !== "object") return fallback;

  // Alguns endpoints devolvem { message } / { mensagem }
  const anyErr = error as { message?: unknown; mensagem?: unknown };
  if (typeof anyErr.message === "string" && anyErr.message.trim()) {
    return anyErr.message.trim();
  }
  if (typeof anyErr.mensagem === "string" && anyErr.mensagem.trim()) {
    return anyErr.mensagem.trim();
  }

  const parsed = error as ZodFlattenError;
  if (!("formErrors" in parsed) && !("fieldErrors" in parsed)) return fallback;

  const messages: string[] = [...(parsed.formErrors ?? [])];

  for (const [field, fieldErrors] of Object.entries(parsed.fieldErrors ?? {})) {
    if (!fieldErrors?.length) continue;
    const label = FIELD_LABELS[field] ?? field;
    for (const message of fieldErrors) {
      messages.push(`${label}: ${message}`);
    }
  }

  return messages.length > 0 ? messages.join(" ") : fallback;
}
