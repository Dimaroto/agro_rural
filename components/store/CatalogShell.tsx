import { CatalogFooter } from "@/components/store/CatalogFooter";
import { CatalogHeader } from "@/components/store/CatalogHeader";
import { CustomerAuthProvider } from "@/lib/customer-auth/provider";
import { AccountModalProvider } from "@/lib/customer-auth/account-modal";
import { CatalogSearchProvider } from "@/lib/catalog-search-context";
import { ProductDetailProvider } from "@/lib/product-detail-context";
import type { CatalogProduct } from "@/components/ProductCard";
import type { HeaderSearchProduct } from "@/lib/header-search-products";

type StoreShellProps = {
  storeName: string;
  storeSlug: string;
  whatsapp: string | null;
  categories: { id: string; name: string; slug: string; sortOrder?: number }[];
  products: CatalogProduct[];
  children: React.ReactNode;
};

function toHeaderProducts(products: CatalogProduct[]): HeaderSearchProduct[] {
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    categoryName: p.categoryName,
    categorySlug: p.categorySlug,
    priceCents: p.priceCents,
    imageUrl: p.imageUrl,
    stockStatus: p.stockStatus,
  }));
}

export function CatalogShell({
  storeName,
  storeSlug,
  whatsapp,
  categories,
  products,
  children,
}: StoreShellProps) {
  const headerProducts = toHeaderProducts(products);

  return (
    <CustomerAuthProvider>
      <AccountModalProvider>
        <CatalogSearchProvider>
          <ProductDetailProvider storeSlug={storeSlug} products={products}>
            <div className="catalog-shell flex min-h-screen flex-col">
              <CatalogHeader
                storeName={storeName}
                storeSlug={storeSlug}
                categories={categories}
                products={headerProducts}
              />
              <div className="catalog-shell__main flex flex-1 flex-col">
                {children}
              </div>
              <CatalogFooter
                storeName={storeName}
                whatsapp={whatsapp}
                categories={categories}
              />
            </div>
          </ProductDetailProvider>
        </CatalogSearchProvider>
      </AccountModalProvider>
    </CustomerAuthProvider>
  );
}
