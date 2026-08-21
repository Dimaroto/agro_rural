/**
 * Atualiza tabelas locais NCM (Siscomex) e CFOP (br-validators / CONFAZ).
 * Uso: node scripts/refresh-fiscal-tables.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "fiscal");
mkdirSync(outDir, { recursive: true });

const NCM_URL =
  "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO";
const CFOP_URL =
  "https://raw.githubusercontent.com/open-data-brazil/br-validators/main/packages/br-validators/src/cfop/data/cfop.json";

async function refreshNcm() {
  const res = await fetch(NCM_URL);
  if (!res.ok) throw new Error(`NCM HTTP ${res.status}`);
  const j = await res.json();
  const out = [];
  for (const row of j.Nomenclaturas ?? []) {
    const code = String(row.Codigo ?? "").replace(/\D/g, "");
    if (code.length !== 8) continue;
    const description = String(row.Descricao ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!description) continue;
    out.push({ code, description });
  }
  out.sort((a, b) => a.code.localeCompare(b.code));
  writeFileSync(path.join(outDir, "ncm.json"), JSON.stringify(out));
  console.log(`NCM: ${out.length} códigos`);
}

async function refreshCfop() {
  const res = await fetch(CFOP_URL);
  if (!res.ok) throw new Error(`CFOP HTTP ${res.status}`);
  const j = await res.json();
  const out = (Array.isArray(j) ? j : [])
    .map((r) => ({
      code: String(r.codigo ?? r.code ?? "").replace(/\D/g, ""),
      description: String(r.descricao ?? r.description ?? "").trim(),
    }))
    .filter((r) => r.code.length === 4 && r.description);
  writeFileSync(path.join(outDir, "cfop.json"), JSON.stringify(out));
  console.log(`CFOP: ${out.length} códigos`);
}

await refreshNcm();
await refreshCfop();
