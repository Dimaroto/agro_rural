import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CUSTOMER_LOGIN_ERROR,
  verifyCustomerPassword,
} from "@/lib/customer-auth-errors";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { decryptCustomerPii } from "@/lib/customer-field-crypto";
import { prisma } from "@/lib/db";
import {
  CUSTOMER_SESSION_COOKIE,
  customerSessionCookieOptions,
} from "@/lib/customer-session";
import { createCustomerSessionToken } from "@/lib/customer-session-token";
import {
  enforceAuthRateLimit,
  RateLimitError,
  rateLimitJsonResponse,
} from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: CUSTOMER_LOGIN_ERROR }, { status: 401 });
  }

  try {
    await enforceAuthRateLimit("customer-login", {
      ip: getClientIpFromRequest(req),
      email: body.data.email,
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitJsonResponse(e.retryAfterSeconds);
    }
    throw e;
  }

  const customer = await prisma.customer.findUnique({
    where: { email: body.data.email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      name: true,
      phone: true,
      street: true,
      number: true,
      district: true,
      city: true,
      zipCode: true,
    },
  });

  const verified = await verifyCustomerPassword(
    body.data.password,
    customer?.passwordHash
  );

  if (!customer || !verified.valid) {
    return NextResponse.json({ error: CUSTOMER_LOGIN_ERROR }, { status: 401 });
  }

  if (verified.upgradedHash) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash: verified.upgradedHash },
    });
  }

  const pii = decryptCustomerPii(customer);

  const response = NextResponse.json({
    customer: {
      id: customer.id,
      email: customer.email,
      name: pii.name,
      phone: pii.phone,
      street: pii.street,
      number: pii.number,
      district: pii.district,
      city: pii.city,
      zipCode: pii.zipCode,
    },
  });
  response.cookies.set(
    CUSTOMER_SESSION_COOKIE,
    await createCustomerSessionToken(customer.id),
    customerSessionCookieOptions()
  );
  return response;
}
