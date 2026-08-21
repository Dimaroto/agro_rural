import { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "./db";
import { config } from "./config";
import { PublicApiError } from "./public-api-error";
import {
  commitReservedStock,
  releaseReservedStock,
  reserveStock,
} from "./inventory";
import {
  getMercadoPagoProvider,
  getPaymentProvider,
  type OnlinePaymentMethod,
} from "./payments";
import {
  formatFieldAnswersLabel,
  stockLinesFromOrderItems,
  validateCartItemCustomization,
} from "./customization";
import type { PartyFavorFieldAnswer } from "./party-favor-fields";
import { productFieldsInclude } from "./product-fields-persist";
import {
  allocateOrderNumber,
  formatOrderCode,
} from "./order-number";
import { formatPrice } from "./format";
import {
  dispatchAdminNotification,
  notifyStockLevel,
} from "./admin-push-dispatch";
import {
  gramsToKgLabel,
  lineTotalCents,
  parseStockUnit,
} from "./stock-unit";

export type OrderItemInput = {
  productId: string;
  quantity: number;
  fieldAnswers?: PartyFavorFieldAnswer[];
  notes?: string;
};

export type CreatedOrderItem = {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  optionsJson: string | null;
};

/** Total da linha respeitando UN vs KG (gramas). */
export function orderItemLineTotalCents(
  item: {
    quantity: number;
    unitPriceCents: number;
    optionsJson?: string | null;
  },
  stockUnit?: string | null
): number {
  let unit = stockUnit;
  if (!unit && item.optionsJson) {
    try {
      const parsed = JSON.parse(item.optionsJson) as { stockUnit?: string };
      unit = parsed.stockUnit;
    } catch {
      unit = undefined;
    }
  }
  return lineTotalCents(item.unitPriceCents, item.quantity, unit);
}

type OnlineOrderForNotification = {
  id: string;
  orderNumber: number | null;
  storeId: string;
  customerName: string | null;
  totalCents: number;
  items: Array<{
    productId: string | null;
    productName: string;
    optionsJson: string | null;
  }>;
};

async function notifyOnlineOrderCreated(
  order: OnlineOrderForNotification,
  paymentLabel: string
) {
  const code = formatOrderCode(order.orderNumber, order.id);
  const customer = order.customerName ? ` · ${order.customerName}` : "";

  await dispatchAdminNotification({
    storeId: order.storeId,
    type: "new_online_order",
    eventId: order.id,
    title: "Novo pedido no catálogo",
    body: `${code}${customer} · ${formatPrice(order.totalCents)} · ${paymentLabel}`,
    url: `/admin/pedidos?q=${encodeURIComponent(code)}`,
    tag: `new-order-${order.id}`,
  });
}

async function notifyOrderStockLevels(
  storeId: string,
  orderId: string,
  items: OrderItemInput[]
) {
  await Promise.all(
    items.map((item) =>
      notifyStockLevel({
        storeId,
        productId: item.productId,
        eventId: `order:${orderId}`,
      })
    )
  );
}

export function buildOrderItems(
  items: OrderItemInput[],
  products: Awaited<ReturnType<typeof loadOrderProducts>>
): CreatedOrderItem[] {
  return items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const answersByField = new Map(
      (item.fieldAnswers ?? []).map((answer) => [answer.fieldId, answer])
    );
    const fieldAnswers = product.customizationFields.flatMap((field) => {
      const answer = answersByField.get(field.id);
      const value = answer?.value?.trim();
      if (!value) return [];
      const selected =
        field.type === "SELECT"
          ? field.options.find(
              (option) =>
                option.id === answer?.optionId || option.label === value
            )
          : null;
      return [{
        fieldId: field.id,
        fieldLabel: field.label,
        type: field.type,
        optionId: selected?.id,
        value: selected?.label ?? value,
      }];
    });

    const stockUnit = parseStockUnit(
      "stockUnit" in product ? product.stockUnit : "UN"
    );

    const options: {
      fieldAnswers?: typeof fieldAnswers;
      notes?: string;
      stockUnit?: "UN" | "KG";
      weightLabel?: string;
    } | null =
      fieldAnswers.length || item.notes || stockUnit === "KG"
        ? {
            fieldAnswers: fieldAnswers.length ? fieldAnswers : undefined,
            notes: item.notes,
            ...(stockUnit === "KG"
              ? {
                  stockUnit: "KG" as const,
                  weightLabel: gramsToKgLabel(item.quantity),
                }
              : {}),
          }
        : null;

    const optionParts = [
      formatFieldAnswersLabel(options?.fieldAnswers) || null,
      options?.notes ? `Obs: ${options.notes}` : null,
      options?.weightLabel ? options.weightLabel : null,
    ].filter(Boolean);

    const optionSuffix = optionParts.join(" · ");

    return {
      productId: product.id,
      productName: optionSuffix
        ? `${product.name} (${optionSuffix})`
        : product.name,
      quantity: item.quantity,
      unitPriceCents: product.priceCents,
      optionsJson: options ? JSON.stringify(options) : null,
    };
  });
}

export async function loadOrderProducts(storeId: string, items: OrderItemInput[]) {
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      storeId,
      active: true,
    },
    include: productFieldsInclude,
  });

  if (products.length !== productIds.length) {
    throw new PublicApiError("Um ou mais produtos inválidos");
  }

  for (const product of products) {
    if (parseStockUnit(product.stockUnit) === "KG") {
      throw new PublicApiError(
        `${product.name}: venda por kg disponível apenas no PDV.`
      );
    }
  }

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)!;
    const error = validateCartItemCustomization({
      fieldAnswers: item.fieldAnswers,
      product: {
        name: product.name,
        customizationFields: product.customizationFields.map((field) => ({
          id: field.id,
          label: field.label,
          type: field.type,
          required: field.required,
          options: field.options.map((o) => ({ id: o.id, label: o.label })),
        })),
      },
    });
    if (error) throw new PublicApiError(`${product.name}: ${error}`);
  }

  return products;
}

export async function createOrderWithPayment(params: {
  paymentMethod: OnlinePaymentMethod;
  storeId: string;
  storeSlug: string;
  items: OrderItemInput[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string;
  cardPayment?: import("./payments/types").CardTokenPaymentInput;
}) {
  if (params.paymentMethod === "card") {
    return createOrderWithCard(params);
  }
  return createOrderWithPix(params);
}

/** Pedido do catálogo via WhatsApp com pagamento em dinheiro (pendente). */
export async function createOrderWithCashWhatsApp(params: {
  storeId: string;
  items: OrderItemInput[];
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
}) {
  const products = await loadOrderProducts(params.storeId, params.items);
  const orderItems = buildOrderItems(params.items, products);

  const totalCents = orderItems.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0
  );

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateOrderNumber(tx, params.storeId);
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + config.cashOrderExpiryMinutes
    );
    const created = await tx.order.create({
      data: {
        storeId: params.storeId,
        customerId: params.customerId,
        orderNumber,
        status: OrderStatus.AWAITING_PAYMENT,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        totalCents,
        pixExpiresAt: expiresAt,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    await tx.payment.create({
      data: {
        orderId: created.id,
        provider: "whatsapp",
        method: "cash",
        status: PaymentStatus.PENDING,
        externalId: `whatsapp-cash-${created.id}`,
      },
    });

    return created;
  });

  await reserveStock(
    params.storeId,
    order.id,
    params.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    }))
  );

  await notifyOnlineOrderCreated(order, "Dinheiro");
  await notifyOrderStockLevels(params.storeId, order.id, params.items);

  return {
    order,
    paymentMethod: "cash" as const,
    orderCode: formatOrderCode(order.orderNumber, order.id),
  };
}

export async function createOrderWithPix(params: {
  storeId: string;
  storeSlug: string;
  items: OrderItemInput[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string;
}) {
  if (!config.paymentsEnabled) {
    throw new PublicApiError("Pagamentos desabilitados");
  }

  const products = await loadOrderProducts(params.storeId, params.items);
  const orderItems = buildOrderItems(params.items, products);

  const totalCents = orderItems.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0
  );

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateOrderNumber(tx, params.storeId);
    return tx.order.create({
      data: {
        storeId: params.storeId,
        customerId: params.customerId,
        orderNumber,
        status: OrderStatus.AWAITING_PIX,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        totalCents,
        items: { create: orderItems },
      },
      include: { items: true },
    });
  });

  await reserveStock(
    params.storeId,
    order.id,
    params.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    }))
  );

  const provider = getPaymentProvider();
  const orderCode = formatOrderCode(order.orderNumber, order.id);
  const charge = await provider.createPixCharge({
    orderId: order.id,
    amountCents: totalCents,
    description: `Pedido ${orderCode} - ${params.storeSlug}`,
    payerEmail: params.customerEmail,
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: config.mercadoPagoAccessToken ? "mercadopago" : "mock",
      method: "pix",
      externalId: charge.externalId,
      status: PaymentStatus.PENDING,
      pixCopyPaste: charge.pixCopyPaste,
      pixQrCode: charge.pixQrCode,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { pixExpiresAt: charge.expiresAt },
  });

  await notifyOnlineOrderCreated(order, "PIX");
  await notifyOrderStockLevels(params.storeId, order.id, params.items);

  return { order, charge, paymentMethod: "pix" as const };
}

export async function createOrderWithCard(params: {
  storeId: string;
  storeSlug: string;
  items: OrderItemInput[];
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string;
  cardPayment?: import("./payments/types").CardTokenPaymentInput;
}) {
  if (!config.cardPaymentsEnabled) {
    throw new PublicApiError("Pagamento com cartão não habilitado");
  }

  if (!config.paymentsEnabled) {
    throw new PublicApiError("Pagamentos desabilitados");
  }

  const products = await loadOrderProducts(params.storeId, params.items);
  const orderItems = buildOrderItems(params.items, products);

  const totalCents = orderItems.reduce(
    (sum, i) => sum + i.unitPriceCents * i.quantity,
    0
  );

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateOrderNumber(tx, params.storeId);
    return tx.order.create({
      data: {
        storeId: params.storeId,
        customerId: params.customerId,
        orderNumber,
        status: OrderStatus.AWAITING_PAYMENT,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        totalCents,
        items: { create: orderItems },
      },
      include: { items: true },
    });
  });

  await reserveStock(
    params.storeId,
    order.id,
    params.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    }))
  );

  const provider = getPaymentProvider();
  const providerName = config.mercadoPagoAccessToken ? "mercadopago" : "mock";
  const orderCode = formatOrderCode(order.orderNumber, order.id);
  const description = `Pedido ${orderCode} - ${params.storeSlug}`;

  // Pagamento com token (Brick no carrinho)
  if (params.cardPayment) {
    if (!provider.createCardTokenPayment) {
      throw new PublicApiError("Pagamento com cartão tokenizado não suportado");
    }

    const charge = await provider.createCardTokenPayment({
      orderId: order.id,
      amountCents: totalCents,
      description,
      card: {
        ...params.cardPayment,
        payerEmail: params.cardPayment.payerEmail ?? params.customerEmail,
      },
    });

    const approved = charge.status === "approved";
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: providerName,
        method: "card",
        externalId: charge.externalId,
        status: PaymentStatus.PENDING,
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { pixExpiresAt: charge.expiresAt },
    });

    if (approved) {
      await confirmOrderPayment(charge.externalId, providerName, {
        orderId: order.id,
      });
    }

    await notifyOnlineOrderCreated(order, "Cartão");
    await notifyOrderStockLevels(params.storeId, order.id, params.items);

    return {
      order,
      charge: {
        externalId: charge.externalId,
        checkoutUrl: "",
        expiresAt: charge.expiresAt,
        status: charge.status,
        statusDetail: charge.statusDetail,
      },
      paymentMethod: "card" as const,
    };
  }

  // Fallback: Checkout Pro (redirect)
  const charge = await provider.createCardCheckout({
    orderId: order.id,
    amountCents: totalCents,
    items: orderItems.map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    payerEmail: params.customerEmail,
  });

  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: providerName,
      method: "card",
      externalId: charge.externalId,
      status: PaymentStatus.PENDING,
      checkoutUrl: charge.checkoutUrl,
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { pixExpiresAt: charge.expiresAt },
  });

  await notifyOnlineOrderCreated(order, "Cartão");
  await notifyOrderStockLevels(params.storeId, order.id, params.items);

  return { order, charge, paymentMethod: "card" as const };
}

export async function confirmOrderPayment(
  externalPaymentId: string,
  provider: string,
  options?: { orderId?: string }
) {
  let payment = await prisma.payment.findFirst({
    where: { externalId: externalPaymentId, provider },
    include: {
      order: { include: { items: true } },
    },
  });

  // Checkout Pro: externalId é o preference_id; o webhook traz o payment id.
  // Localizamos pelo external_reference (= orderId) e atualizamos o externalId.
  if (!payment && options?.orderId) {
    payment = await prisma.payment.findFirst({
      where: {
        orderId: options.orderId,
        provider,
        status: PaymentStatus.PENDING,
      },
      include: {
        order: { include: { items: true } },
      },
    });
  }

  if (!payment || payment.status === PaymentStatus.APPROVED) {
    return payment;
  }

  if (payment.order.status === OrderStatus.PAID) {
    return payment;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.APPROVED,
        paidAt: new Date(),
        ...(payment.externalId !== externalPaymentId
          ? { externalId: externalPaymentId }
          : {}),
      },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.PAID },
    });
  });

  await commitReservedStock(
    payment.order.storeId,
    payment.orderId,
    stockLinesFromOrderItems(payment.order.items)
  );

  if (payment.method === "pix" || payment.method === "card") {
    const code = formatOrderCode(
      payment.order.orderNumber,
      payment.order.id
    );
    const type =
      payment.method === "pix"
        ? "pix_payment_confirmed"
        : "card_payment_confirmed";
    await dispatchAdminNotification({
      storeId: payment.order.storeId,
      type,
      eventId: payment.id,
      title:
        payment.method === "pix" ? "PIX confirmado" : "Cartão aprovado",
      body: `${code} · ${formatPrice(payment.order.totalCents)}${payment.order.customerName ? ` · ${payment.order.customerName}` : ""}`,
      url: `/admin/pedidos?q=${encodeURIComponent(code)}`,
      tag: `payment-approved-${payment.id}`,
    });
  }

  return prisma.payment.findUnique({
    where: { id: payment.id },
    include: { order: true },
  });
}

/**
 * Consulta o Mercado Pago e confirma o pedido se o pagamento já estiver aprovado.
 * Usado no polling da página do pedido (rede de segurança se o webhook falhar).
 */
export async function syncOrderPaymentFromProvider(orderId: string) {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    include: { order: true },
  });

  if (!payment?.externalId) return null;
  if (
    payment.status === PaymentStatus.APPROVED ||
    payment.order.status === OrderStatus.PAID
  ) {
    return payment;
  }
  if (
    payment.order.status !== OrderStatus.AWAITING_PIX &&
    payment.order.status !== OrderStatus.AWAITING_PAYMENT
  ) {
    return payment;
  }

  if (payment.provider !== "mercadopago") {
    return payment;
  }

  const mp = getMercadoPagoProvider();
  if (!mp) return payment;

  // PIX: externalId já é o payment id.
  // Cartão (Checkout Pro): externalId é preference_id — busca por external_reference.
  let mpPayment = await mp.getPayment(payment.externalId);

  if (!mpPayment && payment.method === "card") {
    mpPayment = await mp.findApprovedPaymentByOrderId(orderId);
  }

  if (!mpPayment || mpPayment.status !== "approved") {
    return payment;
  }

  return confirmOrderPayment(String(mpPayment.id), "mercadopago", {
    orderId,
  });
}

export async function cancelExpiredOrders() {
  const now = new Date();
  // Pedidos cash antigos sem pixExpiresAt: usa createdAt + janela de cash.
  const cashFallbackCutoff = new Date(
    now.getTime() - config.cashOrderExpiryMinutes * 60 * 1000
  );

  const expired = await prisma.order.findMany({
    where: {
      status: { in: [OrderStatus.AWAITING_PIX, OrderStatus.AWAITING_PAYMENT] },
      OR: [
        { pixExpiresAt: { lt: now } },
        {
          pixExpiresAt: null,
          createdAt: { lt: cashFallbackCutoff },
          payment: { method: "cash" },
        },
      ],
    },
    include: { items: true },
  });

  for (const order of expired) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.EXPIRED },
    });
    await releaseReservedStock(
      order.storeId,
      order.id,
      stockLinesFromOrderItems(order.items)
    );
    const code = formatOrderCode(order.orderNumber, order.id);
    await dispatchAdminNotification({
      storeId: order.storeId,
      type: "order_cancelled",
      eventId: `expired:${order.id}`,
      title: "Pedido expirado",
      body: `${code} · ${formatPrice(order.totalCents)} · pagamento não concluído`,
      url: `/admin/pedidos?q=${encodeURIComponent(code)}`,
      tag: `order-cancelled-${order.id}`,
    });
  }

  return expired.length;
}

export async function cancelOrderFromCheckout(
  externalCheckoutId: string,
  provider: string,
  reason: "EXPIRED" | "CANCELLED"
) {
  const payment = await prisma.payment.findFirst({
    where: { externalId: externalCheckoutId, provider },
    include: {
      order: { include: { items: true } },
    },
  });

  if (!payment) return null;
  if (
    payment.order.status === OrderStatus.PAID ||
    payment.order.status === OrderStatus.EXPIRED ||
    payment.order.status === OrderStatus.CANCELLED
  ) {
    return payment;
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.REJECTED },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: {
        status:
          reason === "EXPIRED" ? OrderStatus.EXPIRED : OrderStatus.CANCELLED,
      },
    });
  });

  await releaseReservedStock(
    payment.order.storeId,
    payment.orderId,
    stockLinesFromOrderItems(payment.order.items)
  );

  const code = formatOrderCode(
    payment.order.orderNumber,
    payment.order.id
  );
  await dispatchAdminNotification({
    storeId: payment.order.storeId,
    type: "order_cancelled",
    eventId: `${reason.toLowerCase()}:${payment.order.id}`,
    title: reason === "EXPIRED" ? "Pedido expirado" : "Pedido cancelado",
    body: `${code} · ${formatPrice(payment.order.totalCents)}${payment.order.customerName ? ` · ${payment.order.customerName}` : ""}`,
    url: `/admin/pedidos?q=${encodeURIComponent(code)}`,
    tag: `order-cancelled-${payment.order.id}`,
  });

  return payment;
}
