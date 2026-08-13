import { notFound } from "next/navigation";
import { CatalogLoader } from "@/components/catalog/CatalogLoader";
import { config } from "@/lib/config";
import {
  getCategoryBySlug,
  getDefaultStore,
  getStoreCatalog,
} from "@/lib/store";

type Props = { params: Promise<{ categorySlug: string }> };

export default async function ProdutosCategoryPage({ params }: Props) {
  const { categorySlug } = await params;

  const store = await getDefaultStore();
  if (!store) notFound();

  const category = await getCategoryBySlug(store.id, categorySlug);
  if (!category) notFound();

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
      initialCategorySlug={categorySlug}
      categoryTitle={category.name}
    />
  );
}
