import { notFound } from "next/navigation";
import { HomeLanding } from "@/components/catalog/HomeLanding";
import { getDefaultStore, getStoreCatalog } from "@/lib/store";

export default async function HomePage() {
  const store = await getDefaultStore();
  if (!store) notFound();

  const { categories, products } = await getStoreCatalog(store.id);

  return (
    <HomeLanding
      storeName={store.name}
      bannerUrl={store.bannerUrl}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        imageUrl: c.imageUrl,
        showOnHome: c.showOnHome,
      }))}
      products={products}
    />
  );
}
