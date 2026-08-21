import { decryptCustomerPii } from "@/lib/customer-field-crypto";
import { PublicApiError } from "@/lib/public-api-error";
import { lookupCep } from "@/lib/cep";

type NfeCustomer = {
  name: string | null;
  phone: string | null;
  email: string | null;
  document: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  zipCode: string | null;
  state: string | null;
  complement: string | null;
  ie: string | null;
};

type NfeProduct = {
  ncm: string | null;
  cfopDefault: string | null;
  csosn: string | null;
  origemMercadoria: string | null;
  unidadeComercial: string | null;
  barcode: string | null;
};

type NfeOrderItem = {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  product: NfeProduct | null;
};

export type NfeOrderSource = {
  id: string;
  orderNumber: number | null;
  totalCents: number;
  discountCents: number;
  customerName: string | null;
  customerPhone: string | null;
  customer: NfeCustomer | null;
  items: NfeOrderItem[];
};

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Monta o payload simplificado esperado por POST /integracoes/agro/nfe|nfce/emitir.
 */
export async function buildAgroNfePayload(
  order: NfeOrderSource,
  modelo: 55 | 65 = 55
): Promise<Record<string, unknown>> {
  const customer = order.customer
    ? decryptCustomerPii(order.customer)
    : null;

  if (!customer) {
    throw new PublicApiError(
      "Venda sem cliente cadastrado. Vincule um cliente com CPF/CNPJ e endereço (cidade, UF, CEP)."
    );
  }

  const documento = digits(customer.document);
  if (documento.length !== 11 && documento.length !== 14) {
    throw new PublicApiError(
      "Cliente sem CPF/CNPJ válido. Cadastre o documento em Clientes."
    );
  }

  const nome =
    customer.name?.trim() ||
    order.customerName?.trim() ||
    "CONSUMIDOR";

  const cep = digits(customer.zipCode);
  let uf = (customer.state ?? "").trim().toUpperCase();
  let cidade = (customer.city ?? "").trim();
  if (cep.length !== 8) {
    throw new PublicApiError(
      "CEP do cliente inválido. Atualize o cliente em Clientes."
    );
  }

  const cepInfo = await lookupCep(cep);
  const codigoMunicipio = cepInfo?.ibge ?? "";
  if (!codigoMunicipio) {
    throw new PublicApiError(
      `Não foi possível obter o código IBGE do CEP ${cep}. Confira o CEP em Clientes.`
    );
  }
  if (!uf) uf = cepInfo?.state ?? "";
  if (!cidade) cidade = cepInfo?.city ?? "";
  if (uf.length !== 2 || !cidade) {
    throw new PublicApiError(
      "Endereço fiscal incompleto (cidade e UF). Atualize o cliente em Clientes."
    );
  }

  const missingNcm = order.items
    .filter((item) => digits(item.product?.ncm).length !== 8)
    .map((item) => item.productName);
  if (missingNcm.length > 0) {
    const list = missingNcm.slice(0, 3).join(", ");
    const extra =
      missingNcm.length > 3 ? ` (+${missingNcm.length - 3})` : "";
    throw new PublicApiError(
      `Produto(s) sem NCM (8 dígitos): ${list}${extra}. Edite em Produtos.`
    );
  }

  const itens = order.items.map((item) => {
    const ncm = digits(item.product?.ncm);
    return {
      descricao: item.productName,
      quantidade: item.quantity,
      precoUnitario: Number((item.unitPriceCents / 100).toFixed(2)),
      ncm,
      cfop: digits(item.product?.cfopDefault) || "5102",
      csosn: digits(item.product?.csosn) || "102",
      origemMercadoria: digits(item.product?.origemMercadoria) || "0",
      unidade: (item.product?.unidadeComercial || "UN").trim() || "UN",
      gtin: digits(item.product?.barcode) || undefined,
    };
  });

  if (itens.length === 0) {
    throw new PublicApiError("Pedido sem itens.");
  }

  return {
    modelo,
    pedidoId: order.id,
    pedidoNumero: order.orderNumber != null ? String(order.orderNumber) : null,
    referenciaId: order.id,
    valorTotal: Number((order.totalCents / 100).toFixed(2)),
    observacao:
      order.discountCents > 0
        ? `Desconto R$ ${(order.discountCents / 100).toFixed(2).replace(".", ",")}`
        : undefined,
    destinatario: {
      nome,
      documento,
      telefone: digits(customer.phone || order.customerPhone) || undefined,
      email: customer.email ?? undefined,
      ie: customer.ie?.trim() || undefined,
      endereco: {
        logradouro:
          customer.street?.trim() ||
          cepInfo?.street ||
          "NAO INFORMADO",
        numero: customer.number?.trim() || "S/N",
        complemento: customer.complement?.trim() || undefined,
        bairro:
          customer.district?.trim() || cepInfo?.district || "CENTRO",
        cidade,
        uf,
        cep,
        codigoMunicipio,
        codigo_municipio: codigoMunicipio,
      },
    },
    itens,
  };
}
