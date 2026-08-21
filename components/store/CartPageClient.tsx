"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CartPanel } from "@/components/CartSidebar";
import type { CartItem } from "@/components/CartDrawer";
import type { CatalogProduct } from "@/components/ProductCard";
import { useAccountModal } from "@/lib/customer-auth/account-modal";
import { CartCardPayment } from "@/components/cart/CartCardPayment";
import { CartPaidSuccess } from "@/components/cart/CartPaidSuccess";
import {
  CartPixPayment,
  type CartPixOrder,
} from "@/components/cart/CartPixPayment";
import { formatPrice } from "@/lib/format";
import { formatApiError } from "@/lib/apiError";
import {
  formatStockQty,
  lineTotalCents,
  parseStockUnit,
} from "@/lib/stock-unit";
import {
  clearCheckoutSuccess,
  loadCart,
  loadCheckoutSuccess,
  saveCart,
  saveCheckoutSuccess,
  type CheckoutSuccessSnapshot,
} from "@/lib/cartStorage";
import {
  buildCartLineKey,
  formatCartCustomizationSummary,
  splitCartLine,
  validateCartItemsCustomization,
} from "@/lib/customization";
import {
  buildCartWhatsAppMessage,
  openWhatsAppChat,
  validateCartCheckout,
  type CartCheckoutState,
} from "@/lib/cart-checkout";
import { EMPTY_STRUCTURED_ADDRESS } from "@/lib/address";
import { useCustomerAuth } from "@/lib/customer-auth/provider";
import { publicConfig } from "@/lib/public-config";
import { maxOrderQuantity } from "@/lib/inventory";

type CartPageClientProps = {
  storeSlug: string;
  whatsapp: string | null;
  paymentsEnabled: boolean;
  cardPaymentsEnabled: boolean;
  mercadoPagoPublicKey?: string;
};

type PaidCartOrder = {
  orderId: string;
  orderCode: string;
  totalCents: number;
  paymentMethod: "pix" | "card";
  messageLines: string[];
};

/** Evita limpar o carrinho no remount do React Strict Mode. */
let cartPageMountGeneration = 0;

const EMPTY_CHECKOUT: CartCheckoutState = {
  fulfillmentType: "pickup",
  deliveryAddress: { ...EMPTY_STRUCTURED_ADDRESS },
  paymentMethod: "cash",
};

export function CartPageClient({
  storeSlug,
  whatsapp,
  paymentsEnabled,
  cardPaymentsEnabled,
  mercadoPagoPublicKey = "",
}: CartPageClientProps) {
  const router = useRouter();
  const { customer, refresh } = useCustomerAuth();
  const { openAccountModal } = useAccountModal();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [cartError, setCartError] = useState("");
  const [ready, setReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [pixOrder, setPixOrder] = useState<CartPixOrder | null>(null);
  const [paidOrder, setPaidOrder] = useState<PaidCartOrder | null>(null);
  const [cashCompleted, setCashCompleted] = useState(false);
  const [cardError, setCardError] = useState("");
  const [checkout, setCheckout] = useState<CartCheckoutState>(EMPTY_CHECKOUT);
  const pendingCheckoutAction = useRef<(() => void) | null>(null);

  function requireAccount(action: () => void) {
    if (customer) {
      action();
      return;
    }
    pendingCheckoutAction.current = action;
    openAccountModal({
      intent: "checkout",
      initialMode: "register",
      onDismiss: () => {
        pendingCheckoutAction.current = null;
      },
      onSuccess: () => {
        void (async () => {
          await refresh();
          const next = pendingCheckoutAction.current;
          pendingCheckoutAction.current = null;
          if (next) next();
        })();
      },
    });
  }

  function formatCartLine(item: CartItem) {
    const custom = formatCartCustomizationSummary(item);
    const notes = item.notes ? ` — Obs: ${item.notes}` : "";
    const isKg = parseStockUnit(item.product.stockUnit) === "KG";
    const qtyLabel = isKg
      ? formatStockQty(item.quantity, "KG")
      : `${item.quantity}x`;
    const total = lineTotalCents(
      item.product.priceCents,
      item.quantity,
      item.product.stockUnit
    );
    return `• ${qtyLabel} ${item.product.name}${custom ? ` (${custom})` : ""}${notes} — ${formatPrice(total)}`;
  }

  useEffect(() => {
    const snapshot = loadCheckoutSuccess(storeSlug);
    if (snapshot) {
      setCart(snapshot.cart);
      setPaidOrder(snapshot.paidOrder);
      setPixOrder(snapshot.pixOrder);
      setCashCompleted(Boolean(snapshot.cashCompleted));
      setReady(true);
    } else {
      setCart(loadCart(storeSlug, []));
      setReady(true);
    }

    let cancelled = false;
    fetch(`/api/stores/${storeSlug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const catalogProducts = (data.products ?? []) as CatalogProduct[];
        setProducts(catalogProducts);

        const success = loadCheckoutSuccess(storeSlug);
        if (success) {
          // Remount após WhatsApp: mantém itens do snapshot (carrinho no storage já pode estar vazio)
          setCart(success.cart);
          setPaidOrder(success.paidOrder);
          setPixOrder(success.pixOrder);
          setCashCompleted(Boolean(success.cashCompleted));
          return;
        }
        setCart(loadCart(storeSlug, catalogProducts));
      })
      .catch(() => {
        /* mantém o carrinho já carregado do localStorage */
      });

    return () => {
      cancelled = true;
    };
  }, [storeSlug]);

  useEffect(() => {
    if (!ready || paidOrder || pixOrder || cashCompleted) return;
    saveCart(storeSlug, cart);
  }, [cart, storeSlug, ready, paidOrder, pixOrder, cashCompleted]);

  useEffect(() => {
    if (!ready || (!paidOrder && !pixOrder && !cashCompleted)) return;
    const snapshot: CheckoutSuccessSnapshot = {
      cart,
      messageLines:
        paidOrder?.messageLines ??
        (cart.length
          ? cart.map((item) => formatCartLine(item))
          : []),
      paidOrder,
      pixOrder,
      cashCompleted: cashCompleted || undefined,
    };
    saveCheckoutSuccess(storeSlug, snapshot);
  }, [ready, paidOrder, pixOrder, cashCompleted, cart, storeSlug]);

  /** Ao sair do carrinho (trocar de aba), limpa pedido confirmado + itens. */
  useEffect(() => {
    const generation = ++cartPageMountGeneration;
    return () => {
      window.setTimeout(() => {
        if (generation !== cartPageMountGeneration) return;
        if (!loadCheckoutSuccess(storeSlug)) return;
        saveCart(storeSlug, []);
        clearCheckoutSuccess(storeSlug);
      }, 150);
    };
  }, [storeSlug]);

  function assertCartCustomizationReady() {
    const error = validateCartItemsCustomization(cart);
    if (error) {
      setCartError(error);
      setCardError("");
      return false;
    }
    return true;
  }

  const messageLines = useMemo(() => {
    if (paidOrder?.messageLines) return paidOrder.messageLines;
    if (!cart.length) return [];
    return cart.map((item) => formatCartLine(item));
  }, [paidOrder, cart]);

  async function openWhatsApp(checkoutState: CartCheckoutState) {
    if (checkoutState.paymentMethod !== "cash") return;
    if (paying || cashCompleted) return;
    if (!assertCartCustomizationReady()) return;
    const checkoutError = validateCartCheckout(checkoutState);
    if (checkoutError) {
      setCartError(checkoutError);
      return;
    }
    const phone = whatsapp?.replace(/\D/g, "") ?? "";
    if (!phone || cart.length === 0) return;

    setPaying(true);
    setCartError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          items: cartItemsPayload(),
          paymentMethod: "cash",
          customerName: customer?.name || undefined,
          customerPhone: customer?.phone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCartError(formatApiError(data.error, "Erro ao registrar pedido"));
        return;
      }

      const orderTotal =
        typeof data.totalCents === "number"
          ? data.totalCents
          : cart.reduce(
              (s, i) =>
                s +
                lineTotalCents(
                  i.product.priceCents,
                  i.quantity,
                  i.product.stockUnit
                ),
              0
            );
      const lines = cart.map((item) => formatCartLine(item));
      const message = buildCartWhatsAppMessage({
        lines,
        subtotalCents: orderTotal,
        checkout: checkoutState,
        pickupAddress: publicConfig.pickupAddress,
        pickupMapsLink: publicConfig.pickupMapsLink,
        orderCode: data.orderCode,
      });

      // Considera o pedido concluído; limpa o carrinho na próxima saída da página.
      setCashCompleted(true);
      saveCheckoutSuccess(storeSlug, {
        cart,
        messageLines: lines,
        paidOrder: null,
        pixOrder: null,
        cashCompleted: true,
      });
      saveCart(storeSlug, []);

      openWhatsAppChat(phone, message);
    } catch {
      setCartError("Não foi possível registrar o pedido. Tente novamente.");
    } finally {
      setPaying(false);
    }
  }

  function cartItemsPayload() {
    return cart.map((i) => ({
      productId: i.product.id,
      quantity: i.quantity,
      fieldAnswers: i.fieldAnswers,
      notes: i.notes,
    }));
  }

  /** Mantém a tela de sucesso; limpeza só ao sair do carrinho. */
  function leaveCheckoutSuccess(href: string) {
    saveCart(storeSlug, []);
    clearCheckoutSuccess(storeSlug);
    setCart([]);
    setPaidOrder(null);
    setPixOrder(null);
    setCashCompleted(false);
    router.push(href);
  }

  async function startPixPayment() {
    if (cart.length === 0 || paying) return;
    if (!assertCartCustomizationReady()) return;
    setPaying(true);
    setCartError("");
    clearCheckoutSuccess(storeSlug);
    setPixOrder(null);
    setPaidOrder(null);
    setCashCompleted(false);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          items: cartItemsPayload(),
          paymentMethod: "pix",
          customerName: customer?.name || undefined,
          customerPhone: customer?.phone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCartError(formatApiError(data.error, "Erro ao gerar PIX"));
        return;
      }

      const order: CartPixOrder = {
        orderId: data.orderId,
        orderCode: data.orderCode ?? `PD----`,
        accessToken: data.accessToken,
        totalCents: data.totalCents,
        pixCopyPaste: data.pixCopyPaste,
        pixQrCode: data.pixQrCode,
      };
      sessionStorage.setItem(`order-${data.orderId}`, JSON.stringify(data));
      sessionStorage.setItem("last-order-id", data.orderId);
      setPixOrder(order);
    } catch {
      setCartError("Não foi possível gerar o PIX. Tente novamente.");
    } finally {
      setPaying(false);
    }
  }

  const submitCardPayment = useCallback(
    async (cardPayment: {
      token: string;
      paymentMethodId: string;
      installments: number;
      issuerId?: string;
      payerEmail?: string;
      identificationType?: string;
      identificationNumber?: string;
    }) => {
      if (cart.length === 0) return;
      const customizationError = validateCartItemsCustomization(cart);
      if (customizationError) {
        setCartError(customizationError);
        setCardError(customizationError);
        return;
      }
      setPaying(true);
      setCardError("");
      setCartError("");
      clearCheckoutSuccess(storeSlug);
      setCashCompleted(false);

      const lines = cart.map((item) => formatCartLine(item));
      const items = cart.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        fieldAnswers: i.fieldAnswers,
        notes: i.notes,
      }));

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeSlug,
            items,
            paymentMethod: "card",
            customerName: customer?.name || undefined,
            customerPhone: customer?.phone || undefined,
            cardPayment,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCardError(formatApiError(data.error, "Erro no pagamento"));
          return;
        }

        sessionStorage.setItem(`order-${data.orderId}`, JSON.stringify(data));
        sessionStorage.setItem("last-order-id", data.orderId);

        const status = String(data.paymentStatus ?? "").toLowerCase();
        const approved =
          status === "approved" || data.statusDetail === "accredited";
        const rejected =
          status === "rejected" ||
          status === "cancelled" ||
          status === "canceled";

        if (approved) {
          setPaidOrder({
            orderId: data.orderId,
            orderCode: data.orderCode ?? `PD----`,
            totalCents: data.totalCents,
            paymentMethod: "card",
            messageLines: lines,
          });
          setPixOrder(null);
          return;
        }

        if (rejected) {
          setCardError(
            data.statusDetail
              ? `Pagamento recusado (${data.statusDetail}). Confira os dados do cartão ou tente outro.`
              : "Pagamento recusado. Confira os dados do cartão ou tente outro."
          );
          return;
        }

        // Pendente / em análise
        setCardError(
          "Pagamento em análise. Aguarde a confirmação ou abra a página do pedido."
        );
        const tokenQs = data.accessToken
          ? `?token=${encodeURIComponent(data.accessToken)}`
          : "";
        router.replace(`/pedido/${data.orderId}${tokenQs}`);
      } catch {
        setCardError("Não foi possível processar o cartão. Tente novamente.");
      } finally {
        setPaying(false);
      }
    },
    [cart, storeSlug, customer, router, checkout]
  );

  function handleCheckoutStateChange(next: CartCheckoutState) {
    setCheckout(next);
    if (next.paymentMethod !== "card") {
      setCardError("");
    }
  }

  if (!ready) {
    return (
      <div className="cart-page flex items-center justify-center p-8">
        <p className="text-zinc-600">Carregando carrinho…</p>
      </div>
    );
  }

  // Só mostra vazio se não há PIX em andamento nem sucesso de pagamento
  if (cart.length === 0 && !pixOrder && !paidOrder) {
    return (
      <div className="cart-page mx-auto w-full max-w-lg px-4 py-12 text-center sm:px-6">
        <p className="text-zinc-600">Seu carrinho está vazio.</p>
        <Link
          href="/"
          onClick={() => clearCheckoutSuccess(storeSlug)}
          className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white"
        >
          Ver catálogo
        </Link>
      </div>
    );
  }

  const productsSubtotal = cart.reduce(
    (s, i) =>
      s +
      lineTotalCents(i.product.priceCents, i.quantity, i.product.stockUnit),
    0
  );
  const subtotal =
    paidOrder?.totalCents ??
    pixOrder?.totalCents ??
    productsSubtotal;

  const displayItems = paidOrder || pixOrder ? cart : cart;

  return (
    <>
    <CartPanel
      variant="page"
      storeSlug={storeSlug}
      items={displayItems}
      cartError={cartError}
      paying={paying}
      hidePayActions={Boolean(pixOrder || paidOrder || cashCompleted)}
      onUpdateQty={(lineKey, qty) => {
        if (pixOrder || paidOrder || cashCompleted) return;
        setCartError("");
        setCart((prev) =>
          prev
            .map((i) =>
              i.lineKey === lineKey
                ? {
                    ...i,
                    quantity: Math.max(
                      0,
                      Math.min(qty, maxOrderQuantity(i.product.available))
                    ),
                  }
                : i
            )
            .filter((i) => i.quantity > 0)
        );
      }}
      onUpdateNotes={(lineKey, notes) => {
        if (pixOrder || paidOrder || cashCompleted) return;
        setCart((prev) =>
          prev.map((i) => (i.lineKey === lineKey ? { ...i, notes } : i))
        );
      }}
      onUpdateCustomization={(lineKey, patch) => {
        if (pixOrder || paidOrder || cashCompleted) return;
        setCart((prev) => {
          const index = prev.findIndex((i) => i.lineKey === lineKey);
          if (index < 0) return prev;

          const current = prev[index];
          const nextItem = {
            ...current,
            ...patch,
            splitInstanceId:
              patch.splitInstanceId !== undefined
                ? patch.splitInstanceId
                : current.splitInstanceId,
          };
          const newKey = buildCartLineKey(current.product.id, {
            fieldAnswers: nextItem.fieldAnswers,
            splitInstanceId: nextItem.splitInstanceId,
          });

          const mergeIndex = prev.findIndex(
            (i, idx) => idx !== index && i.lineKey === newKey
          );

          if (mergeIndex >= 0) {
            return prev
              .map((i, idx) => {
                if (idx === mergeIndex) {
                  return {
                    ...i,
                    quantity: i.quantity + current.quantity,
                  };
                }
                return i;
              })
              .filter((_, idx) => idx !== index);
          }

          return prev.map((i, idx) =>
            idx === index
              ? {
                  ...nextItem,
                  lineKey: newKey,
                }
              : i
          );
        });
      }}
      onSplitLine={(lineKey) => {
        if (pixOrder || paidOrder || cashCompleted) return;
        setCartError("");
        setCart((prev) => splitCartLine(prev, lineKey));
      }}
      onRemove={(lineKey) => {
        if (pixOrder || paidOrder || cashCompleted) return;
        setCart((prev) => prev.filter((i) => i.lineKey !== lineKey));
      }}
      onCheckout={
        paymentsEnabled && !pixOrder && !paidOrder && !cashCompleted
          ? () => requireAccount(() => void startPixPayment())
          : undefined
      }
      onCardCheckout={undefined}
      onWhatsApp={(state) => requireAccount(() => void openWhatsApp(state))}
      paymentsEnabled={paymentsEnabled}
      cardPaymentsEnabled={cardPaymentsEnabled}
      onClose={() => leaveCheckoutSuccess("/")}
      onBrowseProducts={() =>
        leaveCheckoutSuccess(products.length ? "/produtos" : "/")
      }
      onCheckoutStateChange={handleCheckoutStateChange}
      renderPaymentSlot={(checkout) => {
        if (cashCompleted) {
          return (
            <div className="space-y-2 rounded-xl border border-brand/15 bg-brand-light/40 px-4 py-5 text-center">
              <p className="text-sm font-semibold text-brand-dark">
                Pedido enviado pelo WhatsApp!
              </p>
              <p className="text-sm text-[#5C6B4A]">
                Seu pedido foi registrado. Combine a entrega ou retirada na
                conversa. Ao sair do carrinho, ele será limpo.
              </p>
            </div>
          );
        }
        if (paidOrder) {
          return (
            <CartPaidSuccess
              orderCode={paidOrder.orderCode}
              totalCents={paidOrder.totalCents}
              paymentMethod={paidOrder.paymentMethod}
              whatsapp={whatsapp}
              messageLines={paidOrder.messageLines}
            />
          );
        }
        if (pixOrder) {
          return (
            <CartPixPayment
              order={pixOrder}
              whatsapp={whatsapp}
              messageLines={
                messageLines.length
                  ? messageLines
                  : cart.map((item) => formatCartLine(item))
              }
            />
          );
        }
        if (
          paymentsEnabled &&
          cardPaymentsEnabled &&
          checkout.paymentMethod === "card"
        ) {
          const customizationBlock = validateCartItemsCustomization(cart);
          if (customizationBlock) {
            return (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                {customizationBlock} Preencha os campos obrigatórios nos itens
                acima para pagar com cartão.
              </p>
            );
          }
          return (
            <CartCardPayment
              amountCents={subtotal}
              publicKey={
                mercadoPagoPublicKey || publicConfig.mercadoPagoPublicKey
              }
              loading={paying}
              error={cardError}
              onSubmit={(cardPayment) =>
                requireAccount(() => void submitCardPayment(cardPayment))
              }
            />
          );
        }
        return null;
      }}
    />
    </>
  );
}
