import { readFileSync } from "fs";
import path from "path";

export type FiscalCodeRow = {
  code: string;
  description: string;
};

type TableKind = "ncm" | "cfop";

const cache: Partial<Record<TableKind, FiscalCodeRow[]>> = {};

function loadTable(kind: TableKind): FiscalCodeRow[] {
  if (cache[kind]) return cache[kind]!;
  const file = path.join(process.cwd(), "data", "fiscal", `${kind}.json`);
  const rows = JSON.parse(readFileSync(file, "utf8")) as FiscalCodeRow[];
  cache[kind] = rows;
  return rows;
}

function normalizeQuery(q: string): string {
  return q
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Busca NCM/CFOP por código ou trecho da descrição. */
export function searchFiscalCodes(
  kind: TableKind,
  query: string,
  limit = 20
): FiscalCodeRow[] {
  const q = normalizeQuery(query);
  if (!q) {
    // Sem busca: atalhos mais usados
    if (kind === "cfop") {
      const preferred = ["5102", "5405", "6102", "5101", "5910"];
      const all = loadTable(kind);
      return preferred
        .map((code) => all.find((r) => r.code === code))
        .filter((r): r is FiscalCodeRow => Boolean(r));
    }
    return [];
  }

  const digits = q.replace(/\D/g, "");
  const all = loadTable(kind);
  const scored: Array<{ row: FiscalCodeRow; score: number }> = [];

  for (const row of all) {
    const code = row.code;
    const desc = normalizeQuery(row.description);
    let score = 0;
    if (digits && code.startsWith(digits)) score = 100 - Math.min(digits.length, 20);
    else if (digits && code.includes(digits)) score = 40;
    if (desc.includes(q)) score = Math.max(score, 50);
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && tokens.every((t) => desc.includes(t) || code.includes(t))) {
      score = Math.max(score, 60);
    }
    if (score > 0) scored.push({ row, score });
  }

  scored.sort((a, b) => b.score - a.score || a.row.code.localeCompare(b.row.code));
  return scored.slice(0, Math.min(limit, 50)).map((s) => s.row);
}

export function lookupFiscalCode(
  kind: TableKind,
  code: string
): FiscalCodeRow | null {
  const digits = code.replace(/\D/g, "");
  if (!digits) return null;
  return loadTable(kind).find((r) => r.code === digits) ?? null;
}
