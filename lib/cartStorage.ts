import type { CartItem } from "@/components/CartDrawer";
import type { CatalogProduct } from "@/components/ProductCard";
import { buildCartLineKey } from "@/lib/customization";
import { maxOrderQuantity } from "@/lib/inventory";

const CART_PREFIX = "cart";

export function getCartStorageKey(storeSlug: string) {
  return `${CART_PREFIX}-${storeSlug}`;
}

function hydrateCartItem(
  item: CartItem,
  products: CatalogProduct[]
): CartItem | null {
  const productId = item.product?.id;
  if (!productId) return null;

  const fresh = products.find((p) => p.id === productId);
  const resolved = fresh ?? item.product;
  if (!resolved) return null;

  const hasAvailability = typeof resolved.available === "number";
  const available = hasAvailability ? resolved.available : null;

  const customization = {
    fieldAnswers: item.fieldAnswers,
    splitInstanceId: item.splitInstanceId,
  };

  const lineKey = buildCartLineKey(resolved.id, customization);
  const rawQty = Math.max(1, Math.floor(item.quantity ?? 1));
  const maxQty =
    available != null ? maxOrderQuantity(available) : rawQty;
  if (maxQty <= 0) return null;
  const quantity = Math.min(rawQty, maxQty);

  return {
    lineKey,
    product: {
      ...resolved,
      available: available ?? Math.max(rawQty, 1),
      customizationFields:
        resolved.customizationFields ?? item.product?.customizationFields,
    },
    quantity,
    notes: item.notes,
    ...customization,
  };
}

export function loadCart(
  storeSlug: string,
  products: CatalogProduct[]
): CartItem[] {
  try {
    const key = getCartStorageKey(storeSlug);
    const raw =
      localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];

    const hydrated = parsed
      .map((item) => hydrateCartItem(item, products))
      .filter((item): item is CartItem => item !== null);

    if (localStorage.getItem(key) === null && hydrated.length > 0) {
      saveCart(storeSlug, hydrated);
    }

    return hydrated;
  } catch {
    return [];
  }
}

export function saveCart(storeSlug: string, cart: CartItem[]) {
  try {
    localStorage.setItem(getCartStorageKey(storeSlug), JSON.stringify(cart));
    sessionStorage.removeItem(getCartStorageKey(storeSlug));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cart-updated"));
    }
  } catch {
    /* ignore */
  }
}

export function getCartItemCount(storeSlug: string): number {
  try {
    const raw = localStorage.getItem(getCartStorageKey(storeSlug));
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce((sum, item) => {
      if (item.product?.stockUnit === "KG") return sum + 1;
      return sum + (item.quantity ?? 0);
    }, 0);
  } catch {
    return 0;
  }
}

const CHECKOUT_PREFIX = "checkout";

export function getCheckoutStorageKey(storeSlug?: string) {
  return storeSlug ? `${CHECKOUT_PREFIX}-${storeSlug}` : CHECKOUT_PREFIX;
}

export type CheckoutSessionItem = {
  productId: string;
  quantity: number;
  fieldAnswers?: import("./party-favor-fields").PartyFavorFieldAnswer[];
  notes?: string;
};

export type CheckoutSession = {
  items: CheckoutSessionItem[];
  paymentMethod: "pix" | "card";
};

export function parseCheckoutSession(raw: string): CheckoutSession | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutSession> & {
      items?: CheckoutSessionItem[];
    };
    if (!parsed.items?.length) return null;
    return {
      items: parsed.items,
      paymentMethod: parsed.paymentMethod === "card" ? "card" : "pix",
    };
  } catch {
    return null;
  }
}

function readCheckoutRaw(storeSlug: string): string | null {
  const keys = [getCheckoutStorageKey(storeSlug), getCheckoutStorageKey()];
  for (const key of keys) {
    try {
      const fromLocal = localStorage.getItem(key);
      if (fromLocal) return fromLocal;
      const fromSession = sessionStorage.getItem(key);
      if (fromSession) return fromSession;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Persiste a sessão em localStorage e sessionStorage (mais estável entre navegações). */
export function saveCheckoutSession(
  storeSlug: string,
  session: CheckoutSession
) {
  const payload = JSON.stringify(session);
  const key = getCheckoutStorageKey(storeSlug);
  try {
    localStorage.setItem(key, payload);
    sessionStorage.setItem(key, payload);
    // Chave legada sem slug — evita mismatch de storeSlug no checkout
    localStorage.setItem(getCheckoutStorageKey(), payload);
    sessionStorage.setItem(getCheckoutStorageKey(), payload);
  } catch {
    /* ignore */
  }
}

export function clearCheckoutSession(storeSlug: string) {
  const keys = [getCheckoutStorageKey(storeSlug), getCheckoutStorageKey()];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

function checkoutSessionFromCart(storeSlug: string): CheckoutSession | null {
  const cart = loadCart(storeSlug, []);
  if (cart.length === 0) return null;
  return {
    items: cart.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      fieldAnswers: i.fieldAnswers,
      notes: i.notes,
    })),
    paymentMethod: "pix",
  };
}

export function loadCheckoutSession(storeSlug: string): CheckoutSession | null {
  const raw = readCheckoutRaw(storeSlug);
  if (raw) {
    const session = parseCheckoutSession(raw);
    if (session) return session;
  }
  return checkoutSessionFromCart(storeSlug);
}

/** Snapshot da tela pós-pagamento — sobrevive a remount ao abrir o WhatsApp no mobile. */
const CHECKOUT_SUCCESS_PREFIX = "checkout-success";

export function getCheckoutSuccessKey(storeSlug: string) {
  return `${CHECKOUT_SUCCESS_PREFIX}-${storeSlug}`;
}

export type CheckoutSuccessSnapshot = {
  cart: CartItem[];
  messageLines: string[];
  paidOrder: {
    orderId: string;
    orderCode: string;
    totalCents: number;
    paymentMethod: "pix" | "card";
    messageLines: string[];
  } | null;
  pixOrder: {
    orderId: string;
    orderCode: string;
    totalCents: number;
    pixCopyPaste?: string;
    pixQrCode?: string;
  } | null;
  /** Pedido via WhatsApp (dinheiro) marcado como concluído — limpa ao sair do carrinho. */
  cashCompleted?: boolean;
};

export function saveCheckoutSuccess(
  storeSlug: string,
  snapshot: CheckoutSuccessSnapshot
) {
  const payload = JSON.stringify(snapshot);
  const key = getCheckoutSuccessKey(storeSlug);
  try {
    sessionStorage.setItem(key, payload);
    localStorage.setItem(key, payload);
  } catch {
    /* ignore */
  }
}

export function loadCheckoutSuccess(
  storeSlug: string
): CheckoutSuccessSnapshot | null {
  const key = getCheckoutSuccessKey(storeSlug);
  try {
    const raw =
      sessionStorage.getItem(key) ?? localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutSuccessSnapshot;
    if (
      !parsed ||
      (!parsed.paidOrder && !parsed.pixOrder && !parsed.cashCompleted)
    ) {
      return null;
    }
    if (!Array.isArray(parsed.cart)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCheckoutSuccess(storeSlug: string) {
  const key = getCheckoutSuccessKey(storeSlug);
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
