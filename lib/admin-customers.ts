import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  decryptCustomerPii,
  encryptCustomerPii,
} from "@/lib/customer-field-crypto";
import { completedSaleStatuses } from "@/lib/order-status";
import {
  formatBrPhone,
  isBirthdayToday,
  isValidBrPhone,
  normalizeBrPhone,
  parseBrBirthDateToIso,
} from "@/lib/br-contact";

export type AdminCustomerInput = {
  name: string;
  phone?: string;
  email?: string;
  birthDate?: string;
};

function normalizeBirthDate(value: string | undefined): string {
  const iso = parseBrBirthDateToIso(value ?? "");
  if (!iso) {
    throw new Error("Informe a data de nascimento (DD/MM/AAAA).");
  }
  return iso;
}

function normalizePhoneInput(value: string | undefined): string | null {
  const digits = normalizeBrPhone(value);
  if (!digits) return null;
  if (!isValidBrPhone(digits)) {
    throw new Error("Telefone inválido. Use DDD + número, ex.: (49) 99999-9999.");
  }
  return formatBrPhone(digits);
}

function mapCustomerRow(
  c: {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    birthDate?: string | null;
  },
  extras: {
    openBalanceCents: number;
    paidOrderCount?: number;
    lastOrderAt?: Date | null;
  }
) {
  const pii = decryptCustomerPii(c);
  const birthDate = pii.birthDate ?? null;
  return {
    id: c.id,
    name: pii.name?.trim() || "Sem nome",
    phone: pii.phone ? formatBrPhone(pii.phone) : null,
    email: c.email,
    birthDate,
    isBirthday: isBirthdayToday(birthDate),
    openBalanceCents: extras.openBalanceCents,
    paidOrderCount: extras.paidOrderCount ?? 0,
    lastOrderAt: extras.lastOrderAt ?? null,
  };
}

function isOpenBalance(order: {
  status: OrderStatus;
  payment?: { status: string; method: string | null } | null;
}) {
  if (
    order.status === OrderStatus.AWAITING_PAYMENT ||
    order.status === OrderStatus.AWAITING_PIX
  ) {
    return true;
  }
  return (
    order.status === OrderStatus.DELIVERED &&
    order.payment?.status === "PENDING" &&
    order.payment?.method === "receivable"
  );
}

export async function listAdminCustomers(storeId: string, query?: string) {
  const q = query?.trim() ?? "";
  const customers = await prisma.customer.findMany({
    where: {
      storeId,
    },
    include: {
      orders: {
        where: { storeId },
        select: {
          totalCents: true,
          status: true,
          createdAt: true,
          payment: { select: { status: true, method: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const saleStatuses = completedSaleStatuses();

  return customers
    .map((c) => {
      const openBalanceCents = c.orders
        .filter((o) => isOpenBalance(o))
        .reduce((sum, o) => sum + o.totalCents, 0);
      const paidOrderCount = c.orders.filter((o) =>
        saleStatuses.includes(o.status)
      ).length;
      const lastOrder = [...c.orders].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];

      return mapCustomerRow(c, {
        openBalanceCents,
        paidOrderCount,
        lastOrderAt: lastOrder?.createdAt ?? null,
      });
    })
    .filter((c) => {
      if (!q) return true;
      const hay = `${c.name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
}

export async function createAdminCustomer(
  storeId: string,
  input: AdminCustomerInput
) {
  const name = input.name.trim();
  if (name.length < 2) {
    throw new Error("Informe o nome do cliente.");
  }
  const email = input.email?.trim().toLowerCase() || null;
  if (email) {
    const exists = await prisma.customer.findUnique({ where: { email } });
    if (exists) throw new Error("Já existe um cliente com este e-mail.");
  }

  const birthDate = normalizeBirthDate(input.birthDate);
  const phone = normalizePhoneInput(input.phone);

  const pii = encryptCustomerPii({
    name,
    phone,
    birthDate,
  });

  return prisma.customer.create({
    data: {
      storeId,
      email,
      name: pii.name,
      phone: pii.phone,
      birthDate: pii.birthDate,
    },
  });
}

export async function updateAdminCustomer(
  storeId: string,
  id: string,
  input: AdminCustomerInput
) {
  const existing = await prisma.customer.findFirst({
    where: { id, storeId },
  });
  if (!existing) throw new Error("Cliente não encontrado.");

  const name = input.name.trim();
  if (name.length < 2) {
    throw new Error("Informe o nome do cliente.");
  }
  const email = input.email?.trim().toLowerCase() || null;
  if (email && email !== existing.email) {
    const clash = await prisma.customer.findUnique({ where: { email } });
    if (clash) throw new Error("Já existe um cliente com este e-mail.");
  }

  const birthDate = normalizeBirthDate(input.birthDate);
  const phone = normalizePhoneInput(input.phone);

  const pii = encryptCustomerPii({
    name,
    phone,
    birthDate,
  });

  return prisma.customer.update({
    where: { id },
    data: {
      email,
      name: pii.name,
      phone: pii.phone,
      birthDate: pii.birthDate,
    },
  });
}

export async function getAdminCustomer(storeId: string, id: string) {
  const customer = await prisma.customer.findFirst({
    where: { id, storeId },
    include: {
      orders: {
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalCents: true,
          createdAt: true,
          receivableDueAt: true,
          payment: { select: { status: true, method: true } },
        },
      },
    },
  });
  if (!customer) return null;
  const openBalanceCents = customer.orders
    .filter((o) => isOpenBalance(o))
    .reduce((sum, o) => sum + o.totalCents, 0);

  return {
    ...mapCustomerRow(customer, { openBalanceCents }),
    orders: customer.orders,
  };
}
