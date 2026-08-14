import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { decryptCustomerPii } from "@/lib/customer-field-crypto";
import { parseCustomerSessionToken } from "@/lib/customer-session-token";
import { CUSTOMER_SESSION_COOKIE } from "@/lib/session-cookies";

export { CUSTOMER_SESSION_COOKIE };

export type CustomerProfile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  zipCode: string | null;
};

export async function getCustomerSession(): Promise<CustomerProfile | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  const customerId = await parseCustomerSessionToken(raw);
  if (!customerId) return null;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
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

  if (!customer) return null;

  const pii = decryptCustomerPii(customer);
  return {
    id: customer.id,
    email: customer.email ?? "",
    name: pii.name ?? null,
    phone: pii.phone ?? null,
    street: pii.street ?? null,
    number: pii.number ?? null,
    district: pii.district ?? null,
    city: pii.city ?? null,
    zipCode: pii.zipCode ?? null,
  };
}

export function customerSessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
