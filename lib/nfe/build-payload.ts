import { decryptCustomerPii } from "@/lib/customer-field-crypto";

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
export function buildAgroNfePayload(
  order: NfeOrderSource,
  modelo: 55 | 65 = 55
): Record<string, unknown> {
  const customer = order.customer
    ? decryptCustomerPii(order.customer)
    : null;

  const documento = digits(customer?.document);
  if (documento.length !== 11 && documento.length !== 14) {
    throw new Error(
      "Cliente sem CPF/CNPJ válido. Cadastre o documento em Clientes."
    );
  }

  const nome =
    customer?.name?.trim() ||
    order.customerName?.trim() ||
    "CONSUMIDOR";

  const cep = digits(customer?.zipCode);
  const uf = (customer?.state ?? "").trim().toUpperCase();
  const cidade = (customer?.city ?? "").trim();
  if (cep.length !== 8 || uf.length !== 2 || !cidade) {
    throw new Error(
      "Endereço fiscal incompleto (cidade, UF e CEP). Atualize o cliente."
    );
  }

  const itens = order.items.map((item) => {
    const ncm = digits(item.product?.ncm);
    if (ncm.length !== 8) {
      throw new Error(
        `Produto "${item.productName}" sem NCM (8 dígitos). Edite o produto.`
      );
    }
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
    throw new Error("Pedido sem itens.");
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
      telefone: digits(customer?.phone || order.customerPhone),
      email: customer?.email ?? undefined,
      ie: customer?.ie?.trim() || undefined,
      endereco: {
        logradouro: customer?.street?.trim() || "NAO INFORMADO",
        numero: customer?.number?.trim() || "S/N",
        complemento: customer?.complement?.trim() || undefined,
        bairro: customer?.district?.trim() || "CENTRO",
        cidade,
        uf,
        cep,
      },
    },
    itens,
  };
}
