import { notFound } from "next/navigation";
import { CatalogLoader } from "@/components/catalog/CatalogLoader";
import { config } from "@/lib/config";
import { getDefaultStore, getStoreCatalog } from "@/lib/store";

export default async function ProdutosPage() {
  const store = await getDefaultStore();
  if (!store) notFound();

  const { categories, products } = await getStoreCatalog(store.id);

  return (
    <CatalogLoader
      storeName={store.name}
      storeSlug={store.slug}
      whatsapp={store.whatsapp}
      categories={categories}
      products={products}
      paymentsEnabled={config.paymentsEnabled}
      cardPaymentsEnabled={config.cardPaymentsEnabled}
    />
  );
}
