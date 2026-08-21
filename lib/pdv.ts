import { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "./db";
import {
  availableStock,
  commitReservedStock,
  InventoryError,
  reserveStock,
} from "./inventory";
import {
  buildOrderItems,
  loadOrderProducts,
  type OrderItemInput,
} from "./orders";
import { allocateOrderNumber, formatOrderCode } from "./order-number";
import {
  formatProductCode,
  parseProductCodeQuery,
} from "./product-code";
import { normalizeBarcode } from "./product-barcode";
import {
  productFieldsInclude,
  projectProductFields,
} from "./product-fields-persist";
import { decryptCustomerPii } from "./customer-field-crypto";
import { notifyStockLevel } from "./admin-push-dispatch";
import { searchIncludes } from "./search-text";

export type { PdvPaymentMethod, PdvProductListItem } from "./pdv-shared";
export { PDV_PAYMENT_LABELS } from "./pdv-shared";

import type { PdvCartLine, PdvPaymentMethod, PdvProductListItem } from "./pdv-shared";

export async function listPdvProducts(
  storeId: string,
  query?: string
): Promise<PdvProductListItem[]> {
  const q = query?.trim() ?? "";
  const code = q ? parseProductCodeQuery(q) : null;
  const barcode = normalizeBarcode(q);

  const products = await prisma.product.findMany({
    where: {
      storeId,
      active: true,
    },
    include: {
      category: { select: { name: true, slug: true } },
      ...productFieldsInclude,
    },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    take: q ? 1000 : 80,
  });

  const mapped = products.map((p) => {
    const available = availableStock(p);
    return {
      id: p.id,
      code: p.code,
      codeLabel: formatProductCode(p.code),
      barcode: p.barcode,
      name: p.name,
      categoryName: p.category.name,
      categorySlug: p.category.slug,
      priceCents: p.priceCents,
      available,
      imageUrl: p.imageUrl,
      customizationFields: projectProductFields(p.customizationFields),
    };
  });

  if (!q) return mapped;

  return mapped
    .filter((p) => {
      if (code != null && p.code === code) return true;
      if (barcode && p.barcode && p.barcode.includes(barcode)) return true;
      return (
        searchIncludes(p.name, q) ||
        searchIncludes(p.categoryName, q) ||
        searchIncludes(p.categorySlug, q) ||
        searchIncludes(p.codeLabel, q) ||
        (p.barcode ? searchIncludes(p.barcode, q) : false)
      );
    })
    .slice(0, 80);
}

function mergeCartLines(items: PdvCartLine[]): PdvCartLine[] {
  const map = new Map<string, number>();
  for (const item of items) {
    if (item.quantity <= 0) {
      throw new InventoryError("Quantidade deve ser positiva");
    }
    map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
  }
  return [...map.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

export async function createWalkInSale(params: {
  storeId: string;
  items: PdvCartLine[];
  paymentMethod: PdvPaymentMethod;
  customerId?: string;
  receivedCents?: number;
  dueInDays?: number;
  discountCents?: number;
}) {
  const lines = mergeCartLines(params.items);
  if (lines.length === 0) {
    throw new InventoryError("Adicione pelo menos um produto ao carrinho.");
  }

  const isReceivable = params.paymentMethod === "receivable";
  const isPix = params.paymentMethod === "pix";

  if (isReceivable) {
    const days = params.dueInDays ?? 0;
    if (!Number.isInteger(days) || days < 1) {
      throw new InventoryError("Informe o prazo em dias para receber (mínimo 1).");
    }
    if (!params.customerId) {
      throw new InventoryError("Selecione um cliente para venda a prazo.");
    }
  }

  let customer: {
    id: string;
    name: string | null;
    phone: string | null;
  } | null = null;
  if (params.customerId) {
    const row = await prisma.customer.findFirst({
      where: {
        id: params.customerId,
        OR: [{ storeId: params.storeId }, { storeId: null }],
      },
      select: { id: true, name: true, phone: true, storeId: true },
    });
    if (!row) throw new InventoryError("Cliente não encontrado.");
    customer = decryptCustomerPii(row);
  }

  const orderInputs: OrderItemInput[] = lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
  }));
  const products = await loadOrderProducts(params.storeId, orderInputs);

  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    if (!product) {
      throw new InventoryError("Produto não encontrado");
    }
    const availableForSale = availableStock(product);
    if (line.quantity > availableForSale) {
      throw new InventoryError(
        availableForSale <= 0
          ? `"${product.name}" está esgotado.`
          : `Estoque insuficiente de "${product.name}" (disponível: ${availableForSale}).`
      );
    }
  }

  const orderItems = buildOrderItems(orderInputs, products);
  const subtotalCents = orderItems.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0
  );
  const discountCents = params.discountCents ?? 0;
  if (!Number.isInteger(discountCents) || discountCents < 0) {
    throw new InventoryError("Desconto inválido.");
  }
  if (discountCents > subtotalCents) {
    throw new InventoryError("O desconto não pode ser maior que o subtotal.");
  }
  const totalCents = subtotalCents - discountCents;

  let changeCents = 0;
  if (params.paymentMethod === "cash") {
    const received =
      params.receivedCents != null && params.receivedCents > 0
        ? params.receivedCents
        : totalCents;
    if (!Number.isInteger(received) || received < totalCents) {
      throw new InventoryError(
        "O valor recebido deve ser igual ou maior que o total."
      );
    }
    changeCents = received - totalCents;
  }

  let receivableDueAt: Date | null = null;
  if (isReceivable && params.dueInDays) {
    receivableDueAt = new Date();
    receivableDueAt.setHours(23, 59, 59, 999);
    receivableDueAt.setDate(receivableDueAt.getDate() + params.dueInDays);
  }

  const status = isPix ? OrderStatus.AWAITING_PIX : OrderStatus.DELIVERED;

  const paymentPending = isPix || isReceivable;
  const customerName =
    customer?.name?.trim() ||
    (isReceivable ? "Cliente a prazo" : "Venda presencial");

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateOrderNumber(tx, params.storeId);
    const created = await tx.order.create({
      data: {
        storeId: params.storeId,
        orderNumber,
        status,
        customerId: customer?.id,
        customerName,
        customerPhone: customer?.phone,
        totalCents,
        discountCents,
        receivableDueAt,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    await tx.payment.create({
      data: {
        orderId: created.id,
        provider: "manual",
        method: params.paymentMethod,
        status: paymentPending ? PaymentStatus.PENDING : PaymentStatus.APPROVED,
        paidAt: paymentPending ? null : new Date(),
        externalId: `pdv-${created.id}`,
      },
    });

    return created;
  });

  const stockLines = lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
  }));

  try {
    await reserveStock(params.storeId, order.id, stockLines);
    await commitReservedStock(params.storeId, order.id, stockLines);
  } catch (err) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { orderId: order.id } });
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });
    });
    throw err;
  }

  await Promise.all(
    stockLines.map((line) =>
      notifyStockLevel({
        storeId: params.storeId,
        productId: line.productId,
        eventId: `pdv:${order.id}`,
      })
    )
  );

  try {
    const { createLedgerEntry, todayIsoDay } = await import("@/lib/finance-ledger");
    const methodMap: Record<string, string> = {
      cash: "dinheiro",
      pix: "pix",
      card: "cartao",
      transfer: "transferencia",
      receivable: "outro",
    };
    if (isReceivable && receivableDueAt) {
      const due = receivableDueAt.toISOString().slice(0, 10);
      await createLedgerEntry(params.storeId, {
        type: "INCOME",
        status: "PENDING",
        description: `Pedido #${order.orderNumber ?? order.id.slice(0, 8)} (a prazo)`,
        amountCents: totalCents,
        entryDate: due,
        categoryLabel: "Vendas",
        paymentMethod: "outro",
        customerId: customer?.id,
        customerName,
        orderId: order.id,
        dedupeKey: `order_${order.id}_receivable`,
      });
    } else if (!isPix) {
      await createLedgerEntry(params.storeId, {
        type: "INCOME",
        status: "CONFIRMED",
        description: `Pedido #${order.orderNumber ?? order.id.slice(0, 8)}`,
        amountCents: totalCents,
        entryDate: todayIsoDay(),
        categoryLabel: "Vendas",
        paymentMethod: methodMap[params.paymentMethod] ?? "outro",
        customerId: customer?.id,
        customerName,
        orderId: order.id,
        dedupeKey: `order_${order.id}_sale`,
      });
    }
  } catch (ledgerErr) {
    console.error("[pdv:ledger]", ledgerErr);
  }

  return {
    orderId: order.id,
    orderCode: formatOrderCode(order.orderNumber, order.id),
    totalCents,
    discountCents,
    changeCents,
    receivedCents:
      params.paymentMethod === "cash" ? params.receivedCents : undefined,
    paymentMethod: params.paymentMethod,
    status: order.status,
    dueInDays: isReceivable ? params.dueInDays : undefined,
    receivableDueAt: receivableDueAt?.toISOString() ?? undefined,
    customerName,
    itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
  };
}

export async function confirmPdvPayment(params: {
  storeId: string;
  orderId: string;
}) {
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, storeId: params.storeId },
    include: { payment: true },
  });
  if (!order) throw new InventoryError("Pedido não encontrado.");
  if (order.status !== OrderStatus.AWAITING_PIX) {
    throw new InventoryError("Este pedido não está aguardando PIX.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.DELIVERED },
    });
    if (order.payment) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: { status: PaymentStatus.APPROVED, paidAt: new Date() },
      });
    }
  });

  try {
    const { createLedgerEntry, todayIsoDay } = await import("@/lib/finance-ledger");
    await createLedgerEntry(params.storeId, {
      type: "INCOME",
      status: "CONFIRMED",
      description: `Pedido #${order.orderNumber ?? order.id.slice(0, 8)} (PIX)`,
      amountCents: order.totalCents,
      entryDate: todayIsoDay(),
      categoryLabel: "Vendas",
      paymentMethod: "pix",
      customerId: order.customerId,
      customerName: order.customerName,
      orderId: order.id,
      dedupeKey: `order_${order.id}_sale`,
    });
  } catch (ledgerErr) {
    console.error("[pdv:confirm:ledger]", ledgerErr);
  }

  return {
    orderId: order.id,
    orderCode: formatOrderCode(order.orderNumber, order.id),
    totalCents: order.totalCents,
    status: OrderStatus.DELIVERED,
  };
}
