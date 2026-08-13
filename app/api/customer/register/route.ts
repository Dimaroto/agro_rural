import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { CUSTOMER_REGISTER_ERROR } from "@/lib/customer-auth-errors";
import { getClientIpFromRequest } from "@/lib/client-ip";
import {
  decryptCustomerPii,
  encryptCustomerPii,
} from "@/lib/customer-field-crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password-hash";
import { validatePasswordPolicy } from "@/lib/password-policy";
import {
  CUSTOMER_SESSION_COOKIE,
  customerSessionCookieOptions,
} from "@/lib/customer-session";
import { createCustomerSessionToken } from "@/lib/customer-session-token";
import {
  enforceAuthRateLimit,
  RateLimitError,
  REGISTER_RATE_LIMIT,
  rateLimitJsonResponse,
} from "@/lib/rate-limit";

const profileSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  phone: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
});

function serializeCustomer(customer: {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  zipCode: string | null;
}) {
  const pii = decryptCustomerPii(customer);
  return {
    id: customer.id,
    email: customer.email,
    name: pii.name,
    phone: pii.phone,
    street: pii.street,
    number: pii.number,
    district: pii.district,
    city: pii.city,
    zipCode: pii.zipCode,
  };
}

export async function POST(req: Request) {
  const body = profileSchema.safeParse(await req.json());
  if (!body.success) {
    const nameIssue = body.error.issues.find((i) => i.path[0] === "name");
    if (nameIssue) {
      return NextResponse.json(
        { error: "Informe seu nome (mínimo 2 caracteres)." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: CUSTOMER_REGISTER_ERROR }, { status: 400 });
  }

  const passwordCheck = validatePasswordPolicy(body.data.password);
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.message }, { status: 400 });
  }

  try {
    await enforceAuthRateLimit(
      "customer-register",
      {
        ip: getClientIpFromRequest(req),
        email: body.data.email,
      },
      REGISTER_RATE_LIMIT
    );
  } catch (e) {
    if (e instanceof RateLimitError) {
      return rateLimitJsonResponse(e.retryAfterSeconds);
    }
    throw e;
  }

  const email = body.data.email.toLowerCase().trim();
  const existing = await prisma.customer.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: CUSTOMER_REGISTER_ERROR }, { status: 400 });
  }

  // Senha: bcrypt (irreversível). PII: AES-256-GCM em repouso.
  const passwordHash = await hashPassword(body.data.password);
  const pii = encryptCustomerPii({
    name: body.data.name.trim(),
    phone: body.data.phone,
    street: body.data.street,
    number: body.data.number,
    district: body.data.district,
    city: body.data.city,
    zipCode: body.data.zipCode,
  });

  let customer;
  try {
    customer = await prisma.customer.create({
      data: {
        email,
        passwordHash,
        name: pii.name,
        phone: pii.phone,
        street: pii.street,
        number: pii.number,
        district: pii.district,
        city: pii.city,
        zipCode: pii.zipCode,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        street: true,
        number: true,
        district: true,
        city: true,
        zipCode: true,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ error: CUSTOMER_REGISTER_ERROR }, { status: 400 });
    }
    throw err;
  }

  const response = NextResponse.json({ customer: serializeCustomer(customer) });
  response.cookies.set(
    CUSTOMER_SESSION_COOKIE,
    await createCustomerSessionToken(customer.id),
    customerSessionCookieOptions()
  );
  return response;
}
