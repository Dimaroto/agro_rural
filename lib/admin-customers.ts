import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  decryptCustomerPii,
  encryptCustomerPii,
} from "@/lib/customer-field-crypto";
import { completedSaleStatuses } from "@/lib/order-status";

export type AdminCustomerInput = {
  name: string;
  phone?: string;
  email?: string;
};

function openStatuses(): OrderStatus[] {
  return [OrderStatus.AWAITING_PAYMENT, OrderStatus.AWAITING_PIX];
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
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const saleStatuses = completedSaleStatuses();

  return customers
    .map((c) => {
      const pii = decryptCustomerPii(c);
      const openBalanceCents = c.orders
        .filter((o) => openStatuses().includes(o.status))
        .reduce((sum, o) => sum + o.totalCents, 0);
      const paidOrderCount = c.orders.filter((o) =>
        saleStatuses.includes(o.status)
      ).length;
      const lastOrder = [...c.orders].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0];

      return {
        id: c.id,
        name: pii.name?.trim() || "Sem nome",
        phone: pii.phone,
        email: c.email,
        openBalanceCents,
        paidOrderCount,
        lastOrderAt: lastOrder?.createdAt ?? null,
      };
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

  const pii = encryptCustomerPii({
    name,
    phone: input.phone?.trim() || null,
  });

  return prisma.customer.create({
    data: {
      storeId,
      email,
      name: pii.name,
      phone: pii.phone,
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

  const pii = encryptCustomerPii({
    name,
    phone: input.phone?.trim() || null,
  });

  return prisma.customer.update({
    where: { id },
    data: {
      email,
      name: pii.name,
      phone: pii.phone,
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
        },
      },
    },
  });
  if (!customer) return null;
  const pii = decryptCustomerPii(customer);
  const openBalanceCents = customer.orders
    .filter((o) => openStatuses().includes(o.status))
    .reduce((sum, o) => sum + o.totalCents, 0);

  return {
    id: customer.id,
    name: pii.name?.trim() || "Sem nome",
    phone: pii.phone,
    email: customer.email,
    openBalanceCents,
    orders: customer.orders,
  };
}
