import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureStoreBannerMobileColumn } from "@/lib/ensure-store-banner-mobile";
import {
  MAX_BRAND_PRESETS,
  MAX_PRESET_NAME,
  parseBrandThemeDocument,
  serializeBrandThemeDocument,
} from "@/lib/brand-theme";
import { z } from "zod";

const hex = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use uma cor hexadecimal (#RRGGBB).");

const surfaceSchema = z.object({
  mode: z.enum(["solid", "gradient"]),
  from: hex,
  to: hex,
  shape: z.enum(["linear", "radial", "conic"]),
  angle: z.number().int().min(0).max(360),
  text: hex,
  borderColor: hex.optional(),
  borderWidth: z.number().int().min(0).max(12).optional(),
  borderRadius: z.number().int().min(0).max(999).optional(),
});

const presetSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(MAX_PRESET_NAME),
  header: surfaceSchema,
  buttons: surfaceSchema,
  background: surfaceSchema,
  cards: surfaceSchema.optional(),
  categories: surfaceSchema.optional(),
});

const themeDocumentSchema = z.object({
  version: z.literal(2),
  activePresetId: z.string().min(1).max(80),
  presets: z.array(presetSchema).min(1).max(MAX_BRAND_PRESETS),
});

const patchSchema = z.object({
  whatsapp: z.string().optional(),
  bannerUrl: z.string().nullable().optional(),
  bannerUrlMobile: z.string().nullable().optional(),
  theme: themeDocumentSchema.optional(),
});

function storePayload(store: {
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  bannerUrl: string | null;
  bannerUrlMobile: string | null;
  themeJson: string | null;
}) {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    whatsapp: store.whatsapp,
    bannerUrl: store.bannerUrl,
    bannerUrlMobile: store.bannerUrlMobile,
    theme: parseBrandThemeDocument(store.themeJson),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await ensureStoreBannerMobileColumn();

  const store = await prisma.store.findUnique({
    where: { id: session.user.storeId },
    select: {
      id: true,
      name: true,
      slug: true,
      whatsapp: true,
      bannerUrl: true,
      bannerUrlMobile: true,
      themeJson: true,
    },
  });

  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  return NextResponse.json(storePayload(store));
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.storeId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const data: {
    whatsapp?: string | null;
    bannerUrl?: string | null;
    bannerUrlMobile?: string | null;
    themeJson?: string | null;
  } = {};

  if (body.data.whatsapp !== undefined) {
    const digits = body.data.whatsapp.replace(/\D/g, "");
    if (digits && (digits.length < 10 || digits.length > 15)) {
      return NextResponse.json(
        {
          error:
            "Número inválido. Use DDI + DDD + número (ex: 554984376190).",
        },
        { status: 400 }
      );
    }
    data.whatsapp = digits || null;
  }

  if (body.data.bannerUrl !== undefined) {
    const url = body.data.bannerUrl?.trim() || null;
    data.bannerUrl = url;
  }

  if (body.data.bannerUrlMobile !== undefined) {
    const url = body.data.bannerUrlMobile?.trim() || null;
    data.bannerUrlMobile = url;
  }

  if (body.data.theme !== undefined) {
    const doc = parseBrandThemeDocument(body.data.theme);
    if (!doc.presets.some((p) => p.id === doc.activePresetId)) {
      return NextResponse.json(
        { error: "Predefinição ativa inválida." },
        { status: 400 }
      );
    }
    data.themeJson = serializeBrandThemeDocument(doc);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  await ensureStoreBannerMobileColumn();

  const store = await prisma.store.update({
    where: { id: session.user.storeId },
    data,
    select: {
      id: true,
      name: true,
      slug: true,
      whatsapp: true,
      bannerUrl: true,
      bannerUrlMobile: true,
      themeJson: true,
    },
  });

  return NextResponse.json(storePayload(store));
}
