import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { getCustomerSession } from "@/lib/customer-session";
import { orderAccessToken } from "@/lib/order-access";
import {
  createOrderWithCashWhatsApp,
  createOrderWithPayment,
} from "@/lib/orders";
import { formatOrderCode } from "@/lib/order-number";
import { publicErrorJson } from "@/lib/public-api-error";
import {
  enforceAuthRateLimit,
  ORDER_RATE_LIMIT,
  RateLimitError,
  rateLimitJsonResponse,
} from "@/lib/rate-limit";
import { getDefaultStore, getStoreBySlug } from "@/lib/store";
import { z } from "zod";

const MAX_ITEM_QTY = 99;
const MAX_NOTES = 500;
const MAX_FIELD_VALUE = 200;

const cardPaymentSchema = z.object({
  token: z.string().min(1),
  paymentMethodId: z.string().min(1),
  installments: z.number().int().positive().max(24),
  issuerId: z.string().optional(),
  payerEmail: z.string().email().optional(),
  identificationType: z.string().optional(),
  identificationNumber: z.string().optional(),
});

const schema = z.object({
  storeSlug: z.string().optional(),
  paymentMethod: z.enum(["pix", "card", "cash"]).default("pix"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(64),
        quantity: z.number().int().positive().max(MAX_ITEM_QTY),
        fieldAnswers: z
          .array(
            z.object({
              fieldId: z.string().min(1).max(64),
              fieldLabel: z.string().max(120),
              type: z.enum(["TEXT", "SELECT"]),
              optionId: z.string().max(64).optional(),
              value: z.string().max(MAX_FIELD_VALUE),
            })
          )
          .max(20)
          .optional(),
        notes: z.string().max(MAX_NOTES).optional(),
      })
    )
    .min(1)
    .max(50),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(40).optional(),
  cardPayment: cardPaymentSchema.optional(),
});

export async function POST(req: Request) {
  try {
    await enforceAuthRateLimit(
      "orders:create",
      { ip: getClientIpFromRequest(req) },
      ORDER_RATE_LIMIT
    );
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitJsonResponse(e.retryAfterSeconds);
    }
    throw e;
  }

  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  // Dinheiro via WhatsApp não depende de gateway online.
  if (body.data.paymentMethod !== "cash" && !config.paymentsEnabled) {
    return NextResponse.json(
      { error: "Pagamentos não habilitados" },
      { status: 403 }
    );
  }

  if (body.data.paymentMethod === "card" && !config.cardPaymentsEnabled) {
    return NextResponse.json(
      { error: "Pagamento com cartão não habilitado" },
      { status: 403 }
    );
  }

  const storeSlug = body.data.storeSlug ?? config.defaultStoreSlug;
  const store =
    (await getStoreBySlug(storeSlug)) ?? (await getDefaultStore());
  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  const customer = await getCustomerSession();
  if (!customer) {
    return NextResponse.json(
      {
        error:
          "Crie uma conta ou faça login para finalizar o pedido.",
        code: "AUTH_REQUIRED",
      },
      { status: 401 }
    );
  }

  try {
    if (body.data.paymentMethod === "cash") {
      const result = await createOrderWithCashWhatsApp({
        storeId: store.id,
        items: body.data.items,
        customerId: customer.id,
        customerName: body.data.customerName ?? customer.name ?? undefined,
        customerPhone: body.data.customerPhone ?? customer.phone ?? undefined,
      });

      return NextResponse.json({
        orderId: result.order.id,
        orderCode: result.orderCode,
        accessToken: orderAccessToken(result.order.id),
        paymentMethod: "cash",
        totalCents: result.order.totalCents,
        status: result.order.status,
        expiresAt: result.order.pixExpiresAt,
      });
    }

    const result = await createOrderWithPayment({
      paymentMethod: body.data.paymentMethod,
      storeId: store.id,
      storeSlug: store.slug,
      items: body.data.items,
      customerId: customer.id,
      customerName: body.data.customerName ?? customer.name ?? undefined,
      customerPhone: body.data.customerPhone ?? customer.phone ?? undefined,
      customerEmail: customer.email ?? undefined,
      cardPayment: body.data.cardPayment,
    });

    const { prisma } = await import("@/lib/db");
    const payment = await prisma.payment.findUnique({
      where: { orderId: result.order.id },
    });

    if (result.paymentMethod === "card") {
      const charge = result.charge as {
        checkoutUrl?: string;
        expiresAt: Date;
        status?: string;
        statusDetail?: string;
      };
      const accessToken = orderAccessToken(result.order.id);
      return NextResponse.json({
        orderId: result.order.id,
        orderCode: formatOrderCode(
          result.order.orderNumber,
          result.order.id
        ),
        accessToken,
        paymentMethod: "card",
        totalCents: result.order.totalCents,
        checkoutUrl: payment?.checkoutUrl ?? charge.checkoutUrl ?? "",
        paymentStatus:
          charge.status === "approved" || payment?.status === "APPROVED"
            ? "APPROVED"
            : (payment?.status ?? charge.status),
        statusDetail: charge.statusDetail,
        expiresAt: charge.expiresAt,
      });
    }

    return NextResponse.json({
      orderId: result.order.id,
      orderCode: formatOrderCode(result.order.orderNumber, result.order.id),
      accessToken: orderAccessToken(result.order.id),
      paymentMethod: "pix",
      totalCents: result.order.totalCents,
      pixCopyPaste: payment?.pixCopyPaste ?? result.charge.pixCopyPaste,
      pixQrCode: payment?.pixQrCode ?? result.charge.pixQrCode,
      expiresAt: result.charge.expiresAt,
    });
  } catch (e) {
    return publicErrorJson(
      "orders:create",
      e,
      "Não foi possível criar o pedido. Verifique os itens e tente novamente."
    );
  }
}
