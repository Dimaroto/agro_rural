export type StructuredAddress = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  complement: string;
  mapsLink: string;
};

export const EMPTY_STRUCTURED_ADDRESS: StructuredAddress = {
  street: "",
  number: "",
  neighborhood: "",
  city: "",
  complement: "",
  mapsLink: "",
};

export function formatStructuredAddress(address: StructuredAddress): string {
  const parts = [
    address.street.trim(),
    address.number.trim() ? `nº ${address.number.trim()}` : "",
    address.neighborhood.trim()
      ? `Bairro ${address.neighborhood.trim()}`
      : "",
    address.city.trim(),
  ].filter(Boolean);

  const line = parts.join(", ");
  const complement = address.complement.trim();

  if (complement && line) return `${line} — ${complement}`;
  return line || complement;
}

export function validateStructuredAddress(
  address: StructuredAddress,
  label = "endereço"
): string | null {
  if (!address.street.trim()) return `Informe a rua do ${label}.`;
  if (!address.number.trim()) return `Informe o número do ${label}.`;
  if (!address.neighborhood.trim()) return `Informe o bairro do ${label}.`;
  if (!address.city.trim()) return `Informe a cidade do ${label}.`;
  return null;
}

export function appendMapsLink(lines: string[], mapsLink: string) {
  const link = mapsLink.trim();
  if (link) lines.push(`*Google Maps:* ${link}`);
}
