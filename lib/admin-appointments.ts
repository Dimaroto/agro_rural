import { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptCustomerPii } from "@/lib/customer-field-crypto";
import { formatBrPhone } from "@/lib/br-contact";
import { PublicApiError } from "@/lib/public-api-error";
import {
  type AppointmentRange,
  parseAppointmentStartsAt,
  rangeBounds,
} from "@/lib/appointment-datetime";
import type { AppointmentListItem } from "@/lib/admin-appointments-shared";

export type { AppointmentListItem } from "@/lib/admin-appointments-shared";

function mapAppointment(row: {
  id: string;
  startsAt: Date;
  notes: string | null;
  status: AppointmentStatus;
  customer: {
    id: string;
    name: string | null;
    phone: string | null;
  };
}): AppointmentListItem {
  const pii = decryptCustomerPii(row.customer);
  return {
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    notes: row.notes,
    status: row.status,
    customer: {
      id: row.customer.id,
      name: pii.name?.trim() || "Sem nome",
      phone: pii.phone ? formatBrPhone(pii.phone) : null,
    },
  };
}

export async function listAdminAppointments(
  storeId: string,
  range: AppointmentRange
): Promise<AppointmentListItem[]> {
  const bounds = rangeBounds(range);
  const rows = await prisma.appointment.findMany({
    where: {
      storeId,
      ...(bounds.gte || bounds.lt
        ? {
            startsAt: {
              ...(bounds.gte ? { gte: bounds.gte } : {}),
              ...(bounds.lt ? { lt: bounds.lt } : {}),
            },
          }
        : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
    orderBy:
      range === "all"
        ? { startsAt: "desc" }
        : { startsAt: "asc" },
    take: range === "all" ? 300 : 200,
  });
  return rows.map(mapAppointment);
}

export async function createAdminAppointment(
  storeId: string,
  input: {
    customerId: string;
    date: string;
    time: string;
    notes?: string;
  }
) {
  const customer = await prisma.customer.findFirst({
    where: { id: input.customerId, storeId },
    select: { id: true },
  });
  if (!customer) {
    throw new PublicApiError("Cliente não encontrado.");
  }

  const startsAt = parseAppointmentStartsAt(input.date, input.time);
  if (!startsAt) {
    throw new PublicApiError("Informe uma data e um horário válidos.");
  }

  const notes = input.notes?.trim() || null;
  const created = await prisma.appointment.create({
    data: {
      storeId,
      customerId: customer.id,
      startsAt,
      notes,
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  return mapAppointment(created);
}

export async function updateAdminAppointment(
  storeId: string,
  id: string,
  input: {
    date?: string;
    time?: string;
    notes?: string | null;
    status?: AppointmentStatus;
  }
) {
  const existing = await prisma.appointment.findFirst({
    where: { id, storeId },
  });
  if (!existing) {
    throw new PublicApiError("Agendamento não encontrado.");
  }

  let startsAt = existing.startsAt;
  if (input.date != null && input.time != null) {
    const next = parseAppointmentStartsAt(
      input.date ?? "",
      input.time ?? ""
    );
    if (!next) {
      throw new PublicApiError("Informe uma data e um horário válidos.");
    }
    startsAt = next;
  }

  if (
    input.status &&
    !["SCHEDULED", "COMPLETED", "CANCELLED"].includes(input.status)
  ) {
    throw new PublicApiError("Status inválido.");
  }

  const notes =
    input.notes === undefined ? existing.notes : input.notes?.trim() || null;

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      startsAt,
      notes,
      ...(input.status ? { status: input.status } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  return mapAppointment(updated);
}
