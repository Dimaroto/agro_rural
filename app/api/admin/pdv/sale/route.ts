import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createWalkInSale } from "@/lib/pdv";
import { partyFavorFieldAnswerSchema } from "@/lib/party-favor-fields";
import { publicErrorJson } from "@/lib/public-api-error";
import { z } from "zod";

const saleSchema = z
  .object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    paymentMethod: z.enum(["pix", "card", "cash", "receivable"]),
    dueInDays: z.number().int().positive().optional(),
    markAsDelivered: z.boolean().optional(),
    fieldAnswers: z.array(partyFavorFieldAnswerSchema).optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paymentMethod === "receivable" && (data.dueInDays == null || data.dueInDays < 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["dueInDays"],
        message: "Informe o prazo em dias para receber",
      });
    }
  });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = saleSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const result = await createWalkInSale({
      storeId: session.user.storeId,
      ...body.data,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return publicErrorJson(
      "admin:pdv:sale",
      e,
      "Não foi possível registrar a venda. Verifique os dados e tente novamente."
    );
  }
}
