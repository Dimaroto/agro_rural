import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogShell } from "@/components/store/CatalogShell";
import { config } from "@/lib/config";
import { getDefaultStore, getStoreCatalog } from "@/lib/store";

export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const store = await getDefaultStore();
  if (!store) notFound();

  const { categories, products } = await getStoreCatalog(store.id);

  return (
    <CatalogShell
      storeName={store.name}
      storeSlug={store.slug}
      whatsapp={store.whatsapp}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        sortOrder: c.sortOrder,
        imageUrl: c.imageUrl,
      }))}
      products={products}
    >
      {children}
    </CatalogShell>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const store = await getDefaultStore();
  if (!store) return { title: "Catálogo" };

  return {
    title: `${store.name} | Catálogo`,
    description: `Confira o catálogo de ${store.name}. Sabonetes, sachês perfumados e sprays.`,
    openGraph: {
      title: store.name,
      url: config.appUrl,
      type: "website",
      locale: "pt_BR",
    },
  };
}
