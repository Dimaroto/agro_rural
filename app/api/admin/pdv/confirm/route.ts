import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { confirmPdvPayment } from "@/lib/pdv";
import { publicErrorJson } from "@/lib/public-api-error";
import { z } from "zod";

const schema = z.object({
  orderId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const result = await confirmPdvPayment({
      storeId: session.user.storeId,
      orderId: body.data.orderId,
    });
    return NextResponse.json(result);
  } catch (e) {
    return publicErrorJson(
      "admin:pdv:confirm",
      e,
      "Não foi possível confirmar o pagamento."
    );
  }
}
