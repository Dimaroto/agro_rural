/** Parser XML de NF-e de compra (port Bedendo nfe_xml_parser.dart). */

import { XMLParser } from "fast-xml-parser";

export type PaymentMethodCode =
  | "dinheiro"
  | "cartao"
  | "boleto"
  | "pix"
  | "transferencia"
  | "outro";

export type PurchaseCharge = {
  number: string;
  amountCents: number;
  dueDate: string | null; // YYYY-MM-DD
  paymentMethod: PaymentMethodCode;
};

export type PurchaseItem = {
  supplierCode: string;
  barcode: string | null;
  name: string;
  ncm: string | null;
  cfop: string | null;
  unit: string;
  quantity: number;
  unitCostCents: number;
  totalCents: number;
  origin: string;
  csosn: string | null;
};

export type ParsedPurchaseNfe = {
  accessKey: string;
  number: string;
  series: string;
  model: number;
  issuedAt: string; // ISO
  emitenteName: string;
  emitenteDoc: string;
  emitenteIe: string | null;
  emitenteUf: string | null;
  emitenteCityCode: string | null;
  emitenteStreet: string | null;
  emitenteNumber: string | null;
  emitenteComplement: string | null;
  emitenteDistrict: string | null;
  emitenteCity: string | null;
  emitenteZip: string | null;
  emitentePhone: string | null;
  totalCents: number;
  bcIcmsCents: number;
  icmsCents: number;
  pisCents: number;
  cofinsCents: number;
  paymentMethod: PaymentMethodCode;
  invoiceNumber: string | null;
  charges: PurchaseCharge[];
  items: PurchaseItem[];
  warning: string | null;
  xmlContent: string;
};

export type ParsePurchaseResult =
  | { ok: true; nota: ParsedPurchaseNfe }
  | { ok: false; message: string };

const TOL_CENTS = 2;

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function digits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

function text(node: unknown, key: string): string | null {
  if (node == null || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  const v = obj[key];
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  if (typeof v === "object" && v !== null && "#text" in v) {
    return String((v as { "#text": unknown })["#text"]).trim();
  }
  return null;
}

function moneyToCents(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseDateIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(trimmed);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed.split("T")[0] ?? "");
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = Date.parse(trimmed);
  if (!Number.isNaN(d)) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return null;
}

function formaFromTPag(tPag: string | null): PaymentMethodCode {
  switch (tPag) {
    case "01":
      return "dinheiro";
    case "03":
    case "04":
      return "cartao";
    case "15":
      return "boleto";
    case "17":
      return "pix";
    case "05":
    case "18":
      return "transferencia";
    case "90":
      return "outro";
    default:
      return "boleto";
  }
}

function normalizeIe(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  if (raw.trim().toUpperCase() === "ISENTO") return "ISENTO";
  const d = digits(raw);
  return d || null;
}

function findDeep(obj: unknown, localName: string): unknown {
  if (obj == null || typeof obj !== "object") return null;
  const rec = obj as Record<string, unknown>;
  if (localName in rec) return rec[localName];
  for (const v of Object.values(rec)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const found = findDeep(item, localName);
        if (found != null) return found;
      }
    } else if (v && typeof v === "object") {
      const found = findDeep(v, localName);
      if (found != null) return found;
    }
  }
  return null;
}

function extractKey(infNFe: Record<string, unknown>, root: unknown): string {
  const idAttr = String(infNFe["@_Id"] ?? "");
  const fromId = digits(idAttr);
  if (fromId.length >= 44) return fromId.slice(0, 44);
  const ch =
    text(findDeep(root, "infProt") as object, "chNFe") ??
    (typeof findDeep(root, "chNFe") === "string"
      ? String(findDeep(root, "chNFe"))
      : null);
  const alt = digits(ch);
  if (alt.length >= 44) return alt.slice(0, 44);
  return fromId;
}

/** cProd só vira SKU se não for o mesmo que o EAN/GTIN. */
export function skuFromPurchaseItem(item: PurchaseItem): string | null {
  const code = item.supplierCode.trim();
  if (!code) return null;
  const ean = (item.barcode ?? "").replace(/\D/g, "");
  const codeDigits = code.replace(/\D/g, "");
  if (ean && codeDigits === ean) return null;
  if (/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(codeDigits) && !ean) {
    // cProd parece GTIN sem cEAN — usar como barcode, não como SKU interno
    return null;
  }
  return code;
}

export function barcodeFromPurchaseItem(item: PurchaseItem): string | null {
  const ean = (item.barcode ?? "").replace(/\D/g, "");
  if (ean && ean !== "SEM GTIN" && !/^0+$/.test(ean)) return ean;
  const code = item.supplierCode.replace(/\D/g, "");
  if (/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(code)) return code;
  return null;
}

export function parsePurchaseXml(xmlContent: string): ParsePurchaseResult {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
      isArray: (name) => ["det", "dup", "detPag"].includes(name),
    });
    const root = parser.parse(xmlContent);
    const nfe = findDeep(root, "NFe") ?? root;
    const infNFeRaw = findDeep(nfe, "infNFe");
    if (!infNFeRaw || typeof infNFeRaw !== "object") {
      return { ok: false, message: "XML inválido: bloco infNFe não encontrado." };
    }
    const infNFe = infNFeRaw as Record<string, unknown>;

    const accessKey = extractKey(infNFe, root);
    if (accessKey.length !== 44) {
      return {
        ok: false,
        message: "Chave de acesso da NF-e não encontrada ou inválida.",
      };
    }

    const ide = (infNFe.ide ?? findDeep(infNFe, "ide")) as Record<
      string,
      unknown
    > | null;
    const emit = (infNFe.emit ?? findDeep(infNFe, "emit")) as Record<
      string,
      unknown
    > | null;
    if (!ide || !emit) {
      return {
        ok: false,
        message: "XML incompleto: identificação ou emitente ausentes.",
      };
    }

    const issuedDay = parseDateIso(text(ide, "dhEmi") ?? text(ide, "dEmi"));
    if (!issuedDay) {
      return { ok: false, message: "Data de emissão da NF-e não encontrada." };
    }

    const emitenteName = (text(emit, "xNome") ?? "").trim();
    const emitenteDoc = digits(text(emit, "CNPJ") ?? text(emit, "CPF"));
    if (!emitenteName) {
      return {
        ok: false,
        message: "Nome do emitente (fornecedor) não encontrado no XML.",
      };
    }

    const ender = (emit.enderEmit ?? findDeep(emit, "enderEmit")) as Record<
      string,
      unknown
    > | null;
    const model = Number(text(ide, "mod") ?? "55") || 55;
    const icmsTot = (findDeep(infNFe, "ICMSTot") ?? {}) as Record<
      string,
      unknown
    >;
    const totalCents = moneyToCents(text(icmsTot, "vNF"));
    if (totalCents == null || totalCents <= 0) {
      return {
        ok: false,
        message: "Valor total (vNF) da NF-e não encontrado ou inválido.",
      };
    }

    const paymentMethod = formaFromTPag(
      text(findDeep(infNFe, "detPag") as object, "tPag") ??
        text(findDeep(infNFe, "pag") as object, "tPag")
    );

    const cobr = findDeep(infNFe, "cobr") as Record<string, unknown> | null;
    const fat = cobr
      ? ((cobr.fat ?? findDeep(cobr, "fat")) as Record<string, unknown> | null)
      : null;
    const invoiceNumber = fat ? text(fat, "nFat") : null;
    const liquidCents = fat ? moneyToCents(text(fat, "vLiq")) : null;

    const charges = parseCharges(cobr, totalCents, paymentMethod);
    if (charges.length === 0) {
      return {
        ok: false,
        message: "Nenhuma cobrança válida encontrada na NF-e.",
      };
    }

    const items = parseItems(infNFe);
    const sumCharges = charges.reduce((s, c) => s + c.amountCents, 0);
    const ref = liquidCents ?? totalCents;
    let warning: string | null = null;
    if (Math.abs(sumCharges - ref) > TOL_CENTS) {
      warning = `Soma das cobranças (${(sumCharges / 100).toFixed(2)}) diverge do total (${(ref / 100).toFixed(2)}). Revise antes de confirmar.`;
    }
    if (charges.some((c) => !c.dueDate)) {
      const msg =
        "Há cobrança(s) sem data de vencimento — essas não serão cadastradas no financeiro (preencha a data se quiser lançar).";
      warning = warning ? `${warning} ${msg}` : msg;
    }
    if (items.length === 0) {
      const msg =
        "Nenhum item de produto encontrado — estoque não será atualizado.";
      warning = warning ? `${warning} ${msg}` : msg;
    }

    return {
      ok: true,
      nota: {
        accessKey,
        number: text(ide, "nNF") ?? "",
        series: text(ide, "serie") ?? "",
        model,
        issuedAt: `${issuedDay}T12:00:00.000Z`,
        emitenteName,
        emitenteDoc,
        emitenteIe: normalizeIe(text(emit, "IE")),
        emitenteUf: text(ender, "UF")?.toUpperCase() ?? null,
        emitenteCityCode: digits(text(ender, "cMun")) || null,
        emitenteStreet: text(ender, "xLgr"),
        emitenteNumber: text(ender, "nro"),
        emitenteComplement: text(ender, "xCpl"),
        emitenteDistrict: text(ender, "xBairro"),
        emitenteCity: text(ender, "xMun"),
        emitenteZip: digits(text(ender, "CEP")) || null,
        emitentePhone: digits(text(ender, "fone")) || null,
        totalCents,
        bcIcmsCents: moneyToCents(text(icmsTot, "vBC")) ?? 0,
        icmsCents: moneyToCents(text(icmsTot, "vICMS")) ?? 0,
        pisCents: moneyToCents(text(icmsTot, "vPIS")) ?? 0,
        cofinsCents: moneyToCents(text(icmsTot, "vCOFINS")) ?? 0,
        paymentMethod,
        invoiceNumber,
        charges,
        items,
        warning,
        xmlContent,
      },
    };
  } catch (e) {
    return {
      ok: false,
      message: `Erro ao interpretar NF-e: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

function parseCharges(
  cobr: Record<string, unknown> | null,
  totalCents: number,
  paymentMethod: PaymentMethodCode
): PurchaseCharge[] {
  if (!cobr) {
    return [
      {
        number: "001",
        amountCents: totalCents,
        dueDate: null,
        paymentMethod,
      },
    ];
  }
  const dups = asArray(cobr.dup ?? findDeep(cobr, "dup"));
  if (dups.length === 0) {
    const fat = (cobr.fat ?? findDeep(cobr, "fat")) as Record<
      string,
      unknown
    > | null;
    const amount =
      moneyToCents(text(fat, "vLiq")) ??
      moneyToCents(text(fat, "vOrig")) ??
      totalCents;
    return [
      {
        number: text(fat, "nFat") ?? "001",
        amountCents: amount,
        dueDate: null,
        paymentMethod,
      },
    ];
  }
  const out: PurchaseCharge[] = [];
  dups.forEach((dup, i) => {
    const amount = moneyToCents(text(dup as object, "vDup"));
    if (amount == null || amount <= 0) return;
    out.push({
      number:
        text(dup as object, "nDup") ?? String(i + 1).padStart(3, "0"),
      amountCents: amount,
      dueDate: parseDateIso(text(dup as object, "dVenc")),
      paymentMethod,
    });
  });
  return out;
}

function parseItems(infNFe: Record<string, unknown>): PurchaseItem[] {
  const dets = asArray(infNFe.det ?? findDeep(infNFe, "det"));
  const items: PurchaseItem[] = [];
  for (const det of dets) {
    const prod = (det as { prod?: unknown }).prod ?? findDeep(det, "prod");
    if (!prod || typeof prod !== "object") continue;
    const name = (text(prod, "xProd") ?? "").trim();
    const qCom = Number(text(prod, "qCom")?.replace(",", ".") ?? "0");
    const vUn = moneyToCents(text(prod, "vUnCom")) ?? 0;
    const vProd =
      moneyToCents(text(prod, "vProd")) ?? Math.round(qCom * (vUn / 100) * 100);
    if (!name || !(qCom > 0)) continue;
    const imposto = findDeep(det, "imposto");
    const icmsNode = findDeep(imposto, "ICMS");
    let icmsDet: unknown = null;
    if (icmsNode && typeof icmsNode === "object") {
      const vals = Object.values(icmsNode as object);
      icmsDet = vals[0] ?? null;
    }
    const eanRaw = text(prod, "cEAN") ?? text(prod, "cEANTrib");
    const ean =
      eanRaw && eanRaw.toUpperCase() !== "SEM GTIN"
        ? digits(eanRaw) || eanRaw.trim()
        : null;

    items.push({
      supplierCode: (text(prod, "cProd") ?? "").trim(),
      barcode: ean,
      name,
      ncm: text(prod, "NCM"),
      cfop: text(prod, "CFOP"),
      unit: (text(prod, "uCom") ?? "UN").trim(),
      quantity: qCom,
      unitCostCents: vUn,
      totalCents: vProd,
      origin: text(icmsDet as object, "orig") ?? "0",
      csosn: text(icmsDet as object, "CSOSN"),
    });
  }
  return items;
}
