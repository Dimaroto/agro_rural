import { PublicApiError } from "@/lib/public-api-error";
import { mapCfopDevolucaoCompra } from "@/lib/nfe/cfop-devolucao";
import { lookupCep } from "@/lib/cep";

export type DevolucaoItemInput = {
  id: string;
  quantity: number;
};

type InvoiceItem = {
  id: string;
  name: string;
  ncm: string | null;
  cfop: string | null;
  unit: string;
  quantity: number;
  unitCostCents: number;
  origin: string | null;
  csosn: string | null;
  barcode: string | null;
  productId: string | null;
};

type SupplierLike = {
  name: string;
  tradeName: string | null;
  document: string;
  ie: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  cityCode: string | null;
} | null;

type InvoiceLike = {
  id: string;
  accessKey: string;
  number: string;
  series: string;
  emitenteName: string;
  emitenteDoc: string;
  returnNfeChave?: string | null;
  returnNfeStatus?: string | null;
  supplier: SupplierLike;
  items: InvoiceItem[];
};

function digits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/**
 * Payload Agro para NF-e de devolução de compra (finNFe=4 + NFref).
 */
export async function buildDevolucaoPayload(
  invoice: InvoiceLike,
  selected: DevolucaoItemInput[],
  opts?: { ufEmitente?: string }
): Promise<Record<string, unknown>> {
  const chaveCompra = digits(invoice.accessKey);
  if (chaveCompra.length !== 44) {
    throw new PublicApiError("NF-e de entrada sem chave de acesso válida.");
  }

  if (
    String(invoice.returnNfeStatus ?? "").toLowerCase() === "autorizada" &&
    digits(invoice.returnNfeChave).length === 44
  ) {
    throw new PublicApiError(
      "Já existe devolução autorizada para esta entrada."
    );
  }

  const supplier = invoice.supplier;
  const documento = digits(supplier?.document || invoice.emitenteDoc);
  if (documento.length !== 11 && documento.length !== 14) {
    throw new PublicApiError("Fornecedor sem CPF/CNPJ válido.");
  }

  const nome =
    supplier?.name?.trim() ||
    invoice.emitenteName.trim() ||
    "FORNECEDOR";

  const cep = digits(supplier?.zipCode);
  let uf = (supplier?.state ?? "").toUpperCase().slice(0, 2);
  let cidade = (supplier?.city ?? "").trim();
  let codigoMunicipio = digits(supplier?.cityCode);

  if (
    (codigoMunicipio.length !== 7 || !cidade || uf.length !== 2) &&
    cep.length === 8
  ) {
    const via = await lookupCep(cep);
    if (via) {
      if (codigoMunicipio.length !== 7 && via.ibge) {
        codigoMunicipio = digits(via.ibge);
      }
      if (!cidade && via.city) cidade = via.city;
      if (uf.length !== 2 && via.state) uf = via.state.toUpperCase().slice(0, 2);
    }
  }

  if (codigoMunicipio.length !== 7) {
    throw new PublicApiError(
      "Fornecedor sem código IBGE do município. Edite o cadastro do fornecedor (CEP)."
    );
  }
  if (!cidade || uf.length !== 2 || cep.length !== 8) {
    throw new PublicApiError(
      "Endereço do fornecedor incompleto (cidade, UF e CEP)."
    );
  }

  const byId = new Map(invoice.items.map((i) => [i.id, i]));
  const itens: Record<string, unknown>[] = [];

  for (const sel of selected) {
    const row = byId.get(sel.id);
    if (!row) {
      throw new PublicApiError("Item inválido na devolução.");
    }
    if (!(sel.quantity > 0) || sel.quantity > row.quantity + 1e-9) {
      throw new PublicApiError(
        `Quantidade inválida para «${row.name}» (máx. ${row.quantity}).`
      );
    }
    const preco = row.unitCostCents / 100;
    const ufEmit = (opts?.ufEmitente ?? uf).toUpperCase().slice(0, 2);
    itens.push({
      codigo: row.barcode || row.id.slice(-8),
      descricao: row.name,
      ncm: row.ncm || "00000000",
      cfop: mapCfopDevolucaoCompra(row.cfop, ufEmit, uf),
      unidade: row.unit || "UN",
      quantidade: sel.quantity,
      precoUnitario: preco,
      origemMercadoria: row.origin || "0",
      csosn: row.csosn || "102",
    });
  }

  if (itens.length === 0) {
    throw new PublicApiError("Selecione ao menos um item para devolver.");
  }

  const ie = digits(supplier?.ie);
  return {
    modelo: 55,
    tipo: "devolucao",
    purchaseInvoiceId: invoice.id,
    referenciaId: invoice.id,
    ide: {
      mod: 55,
      finNFe: 4,
      natOp: "DEVOLUCAO DE MERCADORIA",
      indFinal: 0,
      indPres: 1,
    },
    NFref: [{ refNFe: chaveCompra }],
    destinatario: {
      nome,
      documento,
      ie: ie || undefined,
      indIEDest: ie ? 1 : 9,
      telefone: supplier?.phone || undefined,
      email: supplier?.email || undefined,
      endereco: {
        logradouro: supplier?.street || "NAO INFORMADO",
        numero: supplier?.number || "S/N",
        bairro: supplier?.district || "CENTRO",
        cidade,
        uf,
        cep,
        codigoMunicipio,
      },
    },
    itens,
    observacao: `Devolucao da NF-e ${invoice.number}/${invoice.series} chave ${chaveCompra}`,
  };
}
