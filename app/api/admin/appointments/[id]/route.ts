import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { updateAdminAppointment } from "@/lib/admin-appointments";
import { publicErrorJson } from "@/lib/public-api-error";

const patchSchema = z.object({
  date: z.string().optional(),
  time: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  try {
    const appointment = await updateAdminAppointment(
      session.user.storeId,
      id,
      body.data
    );
    return NextResponse.json({ appointment });
  } catch (e) {
    return publicErrorJson(
      "admin:appointments:update",
      e,
      "Não foi possível atualizar o agendamento."
    );
  }
}
