import { NextResponse } from "next/server";
import { getStoreBySlug, getStoreCatalog } from "@/lib/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  const catalog = await getStoreCatalog(store.id);
  return NextResponse.json({
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug,
      whatsapp: store.whatsapp,
      logoUrl: store.logoUrl,
      bannerUrl: store.bannerUrl,
      bannerUrlMobile: store.bannerUrlMobile,
    },
    ...catalog,
  });
}
