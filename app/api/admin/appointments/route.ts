import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createAdminAppointment,
  listAdminAppointments,
} from "@/lib/admin-appointments";
import { publicErrorJson } from "@/lib/public-api-error";
import type { AppointmentRange } from "@/lib/appointment-datetime";

const createSchema = z.object({
  customerId: z.string().min(1, "Selecione um cliente"),
  date: z.string().min(1, "Informe a data"),
  time: z.string().min(1, "Informe o horário"),
  notes: z.string().max(2000).optional(),
});

function parseRange(value: string | null): AppointmentRange {
  if (value === "upcoming" || value === "all") return value;
  return "today";
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const range = parseRange(new URL(req.url).searchParams.get("range"));
  const appointments = await listAdminAppointments(
    session.user.storeId,
    range
  );
  return NextResponse.json({ appointments });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = createSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  try {
    const appointment = await createAdminAppointment(session.user.storeId, {
      customerId: body.data.customerId,
      date: body.data.date,
      time: body.data.time,
      notes: body.data.notes,
    });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (e) {
    return publicErrorJson(
      "admin:appointments:create",
      e,
      "Não foi possível criar o agendamento."
    );
  }
}
