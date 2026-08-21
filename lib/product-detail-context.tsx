"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { forceUnlockBodyScroll } from "@/lib/body-scroll-lock";
import { ProductDetailModal } from "@/components/catalog/ProductDetailModal";
import type { CatalogProduct } from "@/components/ProductCard";
import type { CartItem } from "@/components/CartDrawer";
import { loadCart, saveCart } from "@/lib/cartStorage";
import {
  buildCartLineKey,
  type CartCustomization,
} from "@/lib/customization";
import { maxOrderQuantity } from "@/lib/inventory";
import { parseStockUnit } from "@/lib/stock-unit";

type ProductDetailContextValue = {
  openProduct: (product: CatalogProduct) => void;
  openProductById: (id: string) => void;
  closeProduct: () => void;
  addToCart: (
    product: CatalogProduct,
    customization?: CartCustomization,
    quantity?: number
  ) => void;
  qtyByProduct: Record<string, number>;
};

const ProductDetailContext = createContext<ProductDetailContextValue | null>(
  null
);

function mergeCatalogProductDetail(
  fromApi: CatalogProduct,
  fromList: CatalogProduct
): CatalogProduct {
  return {
    ...fromList,
    ...fromApi,
  };
}

function createCartItem(
  product: CatalogProduct,
  quantity = 1,
  customization?: CartCustomization
): CartItem {
  const resolved: CartCustomization = { ...customization };
  return {
    lineKey: buildCartLineKey(product.id, resolved),
    product,
    quantity,
    ...resolved,
  };
}

function clearModalBodyLock() {
  forceUnlockBodyScroll();
}

export function ProductDetailProvider({
  storeSlug,
  products,
  children,
}: {
  storeSlug: string;
  products: CatalogProduct[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [detailProduct, setDetailProduct] = useState<CatalogProduct | null>(
    null
  );
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, number>>({});
  const productsRef = useRef(products);
  productsRef.current = products;

  const refreshQty = useCallback(() => {
    const cart = loadCart(storeSlug, productsRef.current);
    const map: Record<string, number> = {};
    for (const item of cart) {
      map[item.product.id] = (map[item.product.id] ?? 0) + item.quantity;
    }
    setQtyByProduct(map);
  }, [storeSlug]);

  useEffect(() => {
    refreshQty();
    function onCartUpdated() {
      refreshQty();
    }
    window.addEventListener("cart-updated", onCartUpdated);
    window.addEventListener("storage", onCartUpdated);
    return () => {
      window.removeEventListener("cart-updated", onCartUpdated);
      window.removeEventListener("storage", onCartUpdated);
    };
  }, [refreshQty]);

  const openProduct = useCallback((product: CatalogProduct) => {
    setDetailProduct(product);
    // Listagem vem sem campos de personalização — completa ao abrir o modal.
    void fetch(`/api/catalog/products/${product.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.product) return;
        const merged = mergeCatalogProductDetail(
          data.product as CatalogProduct,
          product
        );
        setDetailProduct((current) =>
          current?.id === product.id ? merged : current
        );
        const catalog = productsRef.current;
        const idx = catalog.findIndex((p) => p.id === product.id);
        if (idx >= 0) {
          const next = [...catalog];
          next[idx] = merged;
          productsRef.current = next;
        }
      })
      .catch(() => {
        /* mantém dados da listagem */
      });
  }, []);

  const openProductById = useCallback((id: string) => {
    const product = productsRef.current.find((p) => p.id === id);
    if (product) setDetailProduct(product);
  }, []);

  const closeProduct = useCallback(() => {
    clearModalBodyLock();
    setDetailProduct(null);
  }, []);

  const addToCart = useCallback(
    (product: CatalogProduct, customization?: CartCustomization, quantity = 1) => {
      if (customization === undefined) {
        setDetailProduct(product);
        return;
      }

      const catalog = productsRef.current;
      const cart = loadCart(storeSlug, catalog);
      const lineKey = buildCartLineKey(product.id, customization);
      const existing = cart.find((i) => i.lineKey === lineKey);
      const maxQty = maxOrderQuantity(product.available);
      const isKg = parseStockUnit(product.stockUnit) === "KG";
      const addQty = Math.max(1, Math.floor(quantity));

      if (maxQty <= 0) {
        refreshQty();
        return;
      }

      let next: CartItem[];
      if (existing) {
        const nextQty = Math.min(existing.quantity + addQty, maxQty);
        if (nextQty === existing.quantity) {
          refreshQty();
          return;
        }
        next = cart.map((i) =>
          i.lineKey === lineKey ? { ...i, quantity: nextQty } : i
        );
      } else {
        next = [
          ...cart,
          createCartItem(product, Math.min(addQty, maxQty), customization),
        ];
      }

      saveCart(storeSlug, next);
      refreshQty();
      if (isKg) {
        setDetailProduct(null);
      }
    },
    [storeSlug, refreshQty]
  );

  const goToCart = useCallback(() => {
    clearModalBodyLock();
    setDetailProduct(null);
    router.push("/carrinho");
  }, [router]);

  const value = useMemo(
    () => ({
      openProduct,
      openProductById,
      closeProduct,
      addToCart,
      qtyByProduct,
    }),
    [openProduct, openProductById, closeProduct, addToCart, qtyByProduct]
  );

  return (
    <ProductDetailContext.Provider value={value}>
      {children}
      <ProductDetailModal
        product={detailProduct}
        qtyByProduct={qtyByProduct}
        onClose={closeProduct}
        onAdd={addToCart}
        onViewCart={goToCart}
      />
    </ProductDetailContext.Provider>
  );
}

export function useProductDetail() {
  const ctx = useContext(ProductDetailContext);
  if (!ctx) {
    throw new Error(
      "useProductDetail deve ser usado dentro de ProductDetailProvider"
    );
  }
  return ctx;
}
