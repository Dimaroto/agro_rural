/** Consulta CEP (ViaCEP / BrasilAPI) e máscaras de endereço/documento. */

export type CepLookupResult = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
  ibge: string;
};

export function formatBrCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatBrCpfCnpj(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) {
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    }
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  // CNPJ: 00.000.000/0000-00
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function pickIbge(raw: unknown): string {
  if (typeof raw === "string" || typeof raw === "number") {
    const d = digits(String(raw));
    return d.length === 7 ? d : "";
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["city", "codigo_ibge", "code", "ibge"]) {
      const d = digits(String(obj[key] ?? ""));
      if (d.length === 7) return d;
    }
  }
  return "";
}

/** Resolve município IBGE a partir do CEP (servidor ou browser). */
export async function lookupCep(cepInput: string): Promise<CepLookupResult | null> {
  const cep = digits(cepInput);
  if (cep.length !== 8) return null;

  try {
    const via = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      cache: "no-store",
    });
    if (via.ok) {
      const data = (await via.json()) as {
        erro?: boolean;
        cep?: string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
        ibge?: string;
      };
      if (!data.erro) {
        const ibge = pickIbge(data.ibge);
        if (ibge && data.localidade && data.uf) {
          return {
            cep,
            street: data.logradouro?.trim() || "",
            district: data.bairro?.trim() || "",
            city: data.localidade.trim(),
            state: data.uf.trim().toUpperCase(),
            ibge,
          };
        }
      }
    }
  } catch {
    /* tenta BrasilAPI */
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      street?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      ibge?: unknown;
    };
    const ibge = pickIbge(data.ibge);
    if (!ibge || !data.city || !data.state) return null;
    return {
      cep,
      street: data.street?.trim() || "",
      district: data.neighborhood?.trim() || "",
      city: data.city.trim(),
      state: data.state.trim().toUpperCase(),
      ibge,
    };
  } catch {
    return null;
  }
}
