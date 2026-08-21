/** Opções fiscais fixas (ICMS origem, CSOSN Simples, unidade comercial). */

export type FiscalOption = { value: string; label: string };

/** Origem da mercadoria (tag orig). */
export const ORIGEM_MERCADORIA_OPTIONS: FiscalOption[] = [
  { value: "0", label: "0 — Nacional (exceto 3, 4, 5 e 8)" },
  { value: "1", label: "1 — Estrangeira — importação direta" },
  { value: "2", label: "2 — Estrangeira — adquirida no mercado interno" },
  {
    value: "3",
    label: "3 — Nacional, conteúdo importação > 40% e ≤ 70%",
  },
  {
    value: "4",
    label: "4 — Nacional, produção conforme processos básicos",
  },
  { value: "5", label: "5 — Nacional, conteúdo importação ≤ 40%" },
  {
    value: "6",
    label: "6 — Estrangeira — importação direta, sem similar nacional",
  },
  {
    value: "7",
    label: "7 — Estrangeira — mercado interno, sem similar nacional",
  },
  { value: "8", label: "8 — Nacional, conteúdo importação > 70%" },
];

/** CSOSN — Código de Situação da Operação — Simples Nacional. */
export const CSOSN_OPTIONS: FiscalOption[] = [
  { value: "101", label: "101 — Tributada com permissão de crédito" },
  { value: "102", label: "102 — Tributada sem permissão de crédito" },
  { value: "103", label: "103 — Isenção do ICMS para faixa de receita" },
  {
    value: "201",
    label: "201 — Tributada com crédito e com ST",
  },
  {
    value: "202",
    label: "202 — Tributada sem crédito e com ST",
  },
  {
    value: "203",
    label: "203 — Isenção para faixa de receita e com ST",
  },
  { value: "300", label: "300 — Imune" },
  { value: "400", label: "400 — Não tributada" },
  { value: "500", label: "500 — ICMS cobrado anteriormente por ST" },
  { value: "900", label: "900 — Outros" },
];

/** Unidades comerciais usuais na NF-e. */
export const UNIDADE_COMERCIAL_OPTIONS: FiscalOption[] = [
  { value: "UN", label: "UN — Unidade" },
  { value: "PC", label: "PC — Peça" },
  { value: "PCT", label: "PCT — Pacote" },
  { value: "CX", label: "CX — Caixa" },
  { value: "FD", label: "FD — Fardo" },
  { value: "SC", label: "SC — Saco" },
  { value: "KG", label: "KG — Quilograma" },
  { value: "G", label: "G — Grama" },
  { value: "L", label: "L — Litro" },
  { value: "ML", label: "ML — Mililitro" },
  { value: "M", label: "M — Metro" },
  { value: "M2", label: "M2 — Metro quadrado" },
  { value: "M3", label: "M3 — Metro cúbico" },
  { value: "PAR", label: "PAR — Par" },
  { value: "KIT", label: "KIT — Kit" },
  { value: "BD", label: "BD — Balde" },
  { value: "RL", label: "RL — Rolo" },
  { value: "TB", label: "TB — Tubo" },
  { value: "GF", label: "GF — Garrafa" },
  { value: "LT", label: "LT — Lata" },
];
