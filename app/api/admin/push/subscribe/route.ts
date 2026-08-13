import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getVapidPublicKey, vapidConfigured } from "@/lib/web-push";
import { ADMIN_NOTIFICATIONS } from "@/lib/admin-notification-prefs";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  prefs: z
    .object({
      alerts: z.record(z.string(), z.boolean()).optional(),
    })
    .optional(),
  userAgent: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  return NextResponse.json({
    configured: vapidConfigured(),
    publicKey: getVapidPublicKey(),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!vapidConfigured()) {
    return NextResponse.json(
      { error: "Push não configurado no servidor (VAPID)" },
      { status: 503 }
    );
  }

  const body = subscribeSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const alerts: Record<string, boolean> = {};
  for (const item of ADMIN_NOTIFICATIONS) {
    const v = body.data.prefs?.alerts?.[item.id];
    alerts[item.id] = typeof v === "boolean" ? v : item.defaultEnabled;
  }

  const prefsJson = JSON.stringify({ alerts });

  const existing = await prisma.adminPushSubscription.findUnique({
    where: { endpoint: body.data.endpoint },
    select: { id: true, storeId: true },
  });

  if (existing && existing.storeId !== session.user.storeId) {
    return NextResponse.json(
      { error: "Esta inscrição já pertence a outra loja." },
      { status: 409 }
    );
  }

  const sub = await prisma.adminPushSubscription.upsert({
    where: { endpoint: body.data.endpoint },
    create: {
      storeId: session.user.storeId,
      userId: session.user.id || null,
      endpoint: body.data.endpoint,
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
      prefsJson,
      userAgent: body.data.userAgent?.slice(0, 400) ?? null,
    },
    update: {
      userId: session.user.id || null,
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
      prefsJson,
      userAgent: body.data.userAgent?.slice(0, 400) ?? null,
    },
  });

  return NextResponse.json({ ok: true, id: sub.id });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = z
    .object({
      endpoint: z.string().url(),
      prefs: z.object({
        alerts: z.record(z.string(), z.boolean()),
      }),
    })
    .safeParse(await req.json());

  if (!body.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const existing = await prisma.adminPushSubscription.findFirst({
    where: {
      endpoint: body.data.endpoint,
      storeId: session.user.storeId,
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Inscrição não encontrada" }, { status: 404 });
  }

  await prisma.adminPushSubscription.update({
    where: { id: existing.id },
    data: { prefsJson: JSON.stringify(body.data.prefs) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = z
    .object({ endpoint: z.string().url() })
    .safeParse(await req.json().catch(() => ({})));

  if (!body.success) {
    return NextResponse.json({ error: "Endpoint inválido" }, { status: 400 });
  }

  await prisma.adminPushSubscription.deleteMany({
    where: {
      endpoint: body.data.endpoint,
      storeId: session.user.storeId,
    },
  });

  return NextResponse.json({ ok: true });
}
