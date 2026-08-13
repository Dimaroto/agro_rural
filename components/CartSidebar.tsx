"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { formatPrice } from "@/lib/format";
import { splitProductDescription } from "@/lib/productDisplay";
import {
  formatCartCustomizationSummary,
  validateCartItemCustomization,
  validateCartItemsCustomization,
} from "@/lib/customization";
import { CartCheckoutOptions } from "@/components/cart/CartCheckoutOptions";
import {
  CartEmptyIcon,
  CloseIcon,
  LeafPlaceholderIcon,
} from "@/components/icons/CartUiIcons";
import { QuantityStepper } from "@/components/catalog/QuantityStepper";
import type { CartCheckoutState } from "@/lib/cart-checkout";
import { validateCartCheckout } from "@/lib/cart-checkout";
import { EMPTY_STRUCTURED_ADDRESS } from "@/lib/address";
import { publicConfig } from "@/lib/public-config";
import type { CartItem } from "./CartDrawer";
import { isPhotoImageUrl } from "@/lib/image-url";
import { maxOrderQuantity } from "@/lib/inventory";

function CartProductThumb({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  const isPhoto = isPhotoImageUrl(imageUrl);

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#E4EAD8]/70 shadow-[inset_0_1px_8px_rgba(20,83,45,0.08)] ring-1 ring-brand/15">
      {isPhoto && imageUrl ? (
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="64px"
          unoptimized
        />
      ) : imageUrl ? (
        <div className="flex h-full items-center justify-center p-2">
          <Image
            src={imageUrl}
            alt=""
            width={40}
            height={40}
            className="opacity-50"
            unoptimized
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-brand/30">
          <LeafPlaceholderIcon className="h-6 w-6" />
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function CustomizationSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
  footer,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<{
    id: string;
    label: string;
    disabled?: boolean;
    suffix?: string;
  }>;
  onChange: (id: string, optionLabel: string) => void;
  footer?: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#6B7280]">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => {
          const selected = options.find((o) => o.id === e.target.value);
          if (selected?.disabled) return;
          onChange(selected?.id ?? "", selected?.label ?? "");
        }}
        className="catalog-select w-full cursor-pointer rounded-xl border border-brand/15 bg-[#F7F4EC]/85 px-3 py-2 text-sm text-brand-dark shadow-inner focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option
            key={option.id}
            value={option.id}
            disabled={option.disabled}
            className={option.disabled ? "text-zinc-400" : undefined}
          >
            {option.label}
            {option.suffix ?? ""}
          </option>
        ))}
      </select>
      {footer}
    </div>
  );
}

function CartLineItem({
  item,
  onUpdateQty,
  onUpdateNotes,
  onUpdateCustomization,
  onRemove,
  onSplitLine,
}: {
  item: CartItem;
  onUpdateQty: (lineKey: string, qty: number) => void;
  onUpdateNotes: (lineKey: string, notes: string) => void;
  onUpdateCustomization: (
    lineKey: string,
    patch: {
      fieldAnswers?: import("@/lib/party-favor-fields").PartyFavorFieldAnswer[];
      splitInstanceId?: string;
    }
  ) => void;
  onRemove: (lineKey: string) => void;
  onSplitLine?: (lineKey: string) => void;
}) {
  const { sizeLabel } = splitProductDescription(item.product.description);
  const lineTotal = item.product.priceCents * item.quantity;
  const customFields = item.product.customizationFields ?? [];
  const canSplitLine = Boolean(onSplitLine) && item.quantity >= 2;
  const lineMaxAvailable = maxOrderQuantity(item.product.available);
  const canCustomize = customFields.length > 0;
  const customizationSummary = formatCartCustomizationSummary(item);
  const customizationError = validateCartItemCustomization(item);

  function updatePartyAnswer(
    fieldId: string,
    fieldLabel: string,
    type: "TEXT" | "SELECT",
    value: string,
    optionId?: string
  ) {
    const current = item.fieldAnswers ?? [];
    const remaining = current.filter((a) => a.fieldId !== fieldId);
    const next = value.trim()
      ? [...remaining, { fieldId, fieldLabel, type, value, optionId }]
      : remaining;
    onUpdateCustomization(item.lineKey, { fieldAnswers: next });
  }

  return (
    <li
      className={`rounded-2xl border p-2.5 shadow-[0_4px_16px_rgba(20,83,45,0.06)] backdrop-blur-sm sm:p-3 ${
        customizationError
          ? "border-red-300 bg-red-50/70 ring-1 ring-red-200"
          : "border-[#d8cfc0]/65 bg-[#F7F4EC]/88"
      }`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <CartProductThumb
          imageUrl={item.product.imageUrl}
          name={item.product.name}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm leading-snug font-semibold text-brand-dark">
                {item.product.name}
              </p>
              {sizeLabel && (
                <p className="mt-0.5 text-sm text-[#6B7280]">{sizeLabel}</p>
              )}
              {customizationSummary && (
                <p className="mt-0.5 text-sm font-medium text-brand">
                  {customizationSummary}
                </p>
              )}
              {customizationError && (
                <p className="mt-1 text-xs font-medium text-red-700">
                  {customizationError}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.lineKey)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200/80 bg-red-50/80 text-red-600 transition-colors touch-manipulation hover:bg-red-100 active:bg-red-200"
              aria-label={`Remover ${item.product.name} do carrinho`}
            >
              <TrashIcon />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-[#6B7280]">
              <span>{formatPrice(item.product.priceCents)}</span>
              {item.quantity > 1 && (
                <span className="text-[#6B7280]/70"> × {item.quantity}</span>
              )}
              {item.quantity > 1 && (
                <span className="ml-2 font-semibold text-brand">
                  {formatPrice(lineTotal)}
                </span>
              )}
            </div>
            <QuantityStepper
              value={item.quantity}
              min={1}
              max={Math.max(1, lineMaxAvailable)}
              onChange={(qty) => onUpdateQty(item.lineKey, qty)}
              disabled={lineMaxAvailable <= 0}
              compact
            />
          </div>

          {canSplitLine && (
            <button
              type="button"
              onClick={() => onSplitLine?.(item.lineKey)}
              className="mt-2 w-full rounded-xl border border-brand/25 bg-white/80 px-3 py-2 text-left text-xs font-semibold text-brand-dark transition-colors touch-manipulation hover:border-brand hover:bg-[#E4EAD8]/80 active:bg-[#E4EAD8]"
            >
              Separar 1 unidade
            </button>
          )}
        </div>
      </div>

      {canCustomize && (
        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {customFields.map((field) => {
            const answer = item.fieldAnswers?.find(
              (a) => a.fieldId === field.id
            );
            if (field.type === "TEXT") {
              return (
                <div key={field.id} className="sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-700">
                    {field.label}
                    {field.required ? " *" : ""}
                  </label>
                  <input
                    value={answer?.value ?? ""}
                    onChange={(e) =>
                      updatePartyAnswer(
                        field.id,
                        field.label,
                        "TEXT",
                        e.target.value
                      )
                    }
                    className="cart-field-input mt-1 w-full rounded-xl border border-brand/15 bg-[#F7F4EC]/85 px-3 py-2 text-sm text-brand-dark placeholder:text-[#5C6B4A]/60 shadow-inner outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                    placeholder={`Digite ${field.label.toLowerCase()}`}
                  />
                </div>
              );
            }
            return (
              <CustomizationSelect
                key={field.id}
                label={`${field.label}${field.required ? " *" : ""}`}
                value={answer?.optionId ?? ""}
                placeholder={`Selecione ${field.label.toLowerCase()}`}
                options={field.options.map((o) => ({
                  id: o.id,
                  label: o.label,
                }))}
                onChange={(id, label) =>
                  updatePartyAnswer(
                    field.id,
                    field.label,
                    "SELECT",
                    label,
                    id
                  )
                }
              />
            );
          })}
        </div>
      )}

      <div className="mt-2.5">
        <label
          htmlFor={`cart-notes-${item.lineKey}`}
          className="mb-1.5 block text-sm font-semibold text-[#5C6B4A]"
        >
          Observações
        </label>
        <input
          id={`cart-notes-${item.lineKey}`}
          type="text"
          value={item.notes ?? ""}
          onChange={(e) => onUpdateNotes(item.lineKey, e.target.value)}
          placeholder="Ex.: mensagem no cartão"
          className="w-full rounded-xl border border-brand/15 bg-[#F7F4EC]/85 px-3 py-2 text-sm text-brand-dark placeholder:text-[#5C6B4A]/60 shadow-inner focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>
    </li>
  );
}

export function CartPanelShell({
  children,
  className = "",
  variant = "modal",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "modal" | "page";
}) {
  const shellRounding =
    variant === "page"
      ? "rounded-2xl"
      : "rounded-t-[2rem] sm:rounded-[2rem]";

  return (
    <div
      className={`cart-sidebar__panel relative flex w-full max-w-[min(100%,1568px)] flex-col overflow-y-auto overscroll-contain max-sm:max-h-[92dvh] sm:max-h-[min(94dvh,1260px)] sm:w-[min(98vw,1568px)] ${shellRounding} ${className}`}
    >
      <div className={`flex w-full flex-col border-t border-white/70 shadow-[0_-18px_60px_rgba(20,83,45,0.18)] sm:border sm:border-white/70 sm:shadow-[0_24px_80px_rgba(20,83,45,0.22)] ${shellRounding}`}>
        {children}
      </div>
    </div>
  );
}

export function CartPanel({
  items,
  cartError,
  onUpdateQty,
  onUpdateNotes,
  onUpdateCustomization,
  onRemove,
  onSplitLine,
  onCheckout,
  onCardCheckout,
  onWhatsApp,
  paymentsEnabled,
  cardPaymentsEnabled = false,
  onClose,
  onBrowseProducts,
  variant = "modal",
  renderPaymentSlot,
  paying = false,
  hidePayActions = false,
  onCheckoutStateChange,
  storeSlug,
}: {
  items: CartItem[];
  cartError: string;
  onUpdateQty: (lineKey: string, qty: number) => void;
  onUpdateNotes: (lineKey: string, notes: string) => void;
  onUpdateCustomization: (
    lineKey: string,
    patch: {
      fieldAnswers?: import("@/lib/party-favor-fields").PartyFavorFieldAnswer[];
      splitInstanceId?: string;
    }
  ) => void;
  onRemove: (lineKey: string) => void;
  onSplitLine?: (lineKey: string) => void;
  onCheckout?: () => void;
  onCardCheckout?: () => void;
  onWhatsApp: (checkout: CartCheckoutState) => void;
  paymentsEnabled: boolean;
  cardPaymentsEnabled?: boolean;
  onClose: () => void;
  onBrowseProducts: () => void;
  variant?: "modal" | "page";
  /** Conteúdo de pagamento online conforme o método selecionado. */
  renderPaymentSlot?: (checkout: CartCheckoutState) => ReactNode;
  paying?: boolean;
  hidePayActions?: boolean;
  onCheckoutStateChange?: (checkout: CartCheckoutState) => void;
  storeSlug: string;
}) {
  const [checkout, setCheckout] = useState<CartCheckoutState>({
    fulfillmentType: "pickup",
    deliveryAddress: { ...EMPTY_STRUCTURED_ADDRESS },
    paymentMethod: "cash",
  });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setCheckout((prev) => {
      if (!paymentsEnabled && prev.paymentMethod !== "cash") {
        return { ...prev, paymentMethod: "cash" };
      }
      if (
        paymentsEnabled &&
        !cardPaymentsEnabled &&
        prev.paymentMethod === "card"
      ) {
        return { ...prev, paymentMethod: "pix" };
      }
      return prev;
    });
  }, [paymentsEnabled, cardPaymentsEnabled]);

  const productsSubtotal = items.reduce(
    (s, i) => s + i.product.priceCents * i.quantity,
    0
  );
  const subtotal = productsSubtotal;
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const displayError = cartError || localError;
  const customizationError = validateCartItemsCustomization(items);

  const isPage = variant === "page";

  useEffect(() => {
    setLocalError("");
  }, [items]);

  function handleCheckoutChange(patch: Partial<CartCheckoutState>) {
    setLocalError("");
    setCheckout((prev) => {
      const next = { ...prev, ...patch };
      onCheckoutStateChange?.(next);
      return next;
    });
  }

  function validateItems() {
    return validateCartItemsCustomization(items);
  }

  function handleCardCheckout() {
    const error = validateItems() ?? validateCartCheckout(checkout);
    if (error) {
      setLocalError(error);
      return;
    }
    setLocalError("");
    onCardCheckout?.();
  }

  function handlePixCheckout() {
    const error = validateItems() ?? validateCartCheckout(checkout);
    if (error) {
      setLocalError(error);
      return;
    }
    setLocalError("");
    onCheckout?.();
  }

  function handleWhatsApp() {
    const error = validateItems() ?? validateCartCheckout(checkout);
    if (error) {
      setLocalError(error);
      return;
    }
    setLocalError("");
    onWhatsApp(checkout);
  }

  return (
    <div
      className={`cart-panel relative flex flex-col bg-brand-cream ${isPage ? "cart-panel--page" : ""}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:var(--catalog-paper-texture)] [background-size:320px_320px] mix-blend-multiply" aria-hidden />

      <div
        className={`cart-panel__header flex shrink-0 items-center justify-between gap-2 border-b border-brand/10 bg-[#F7F4EC]/95 py-4 backdrop-blur-md ${
          isPage ? "" : "sticky top-0 z-30"
        }`}
      >
        <div>
          <h2 className="text-xl font-extrabold tracking-[-0.02em] text-brand-dark sm:text-2xl">Carrinho</h2>
          <p className="text-sm font-medium text-[#5C6B4A] sm:text-base">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </p>
        </div>
        {!isPage && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand/15 bg-[#fffaf2]/85 text-brand-dark shadow-sm transition-colors hover:bg-brand-light/50 touch-manipulation"
            aria-label="Fechar carrinho"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-[var(--cart-gutter-x)] py-12 text-center">
          <span className="text-brand/35" aria-hidden>
            <CartEmptyIcon />
          </span>
          <p className="mt-4 text-base font-semibold text-brand-dark">
            Seu carrinho está vazio
          </p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Adicione alguns produtos para começar.
          </p>
          <button
            type="button"
            onClick={onBrowseProducts}
            className="mt-6 rounded-2xl bg-brand-dark px-6 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,35,28,0.2)] touch-manipulation hover:bg-brand"
          >
            Ver todos
          </button>
        </div>
      ) : (
        <div className="cart-panel__body">
          <div className="cart-panel__grid">
            <p className="cart-panel__section-label">
              Itens do pedido
            </p>
            <ul className="cart-panel__list space-y-3">
              {items.map((item) => (
                  <CartLineItem
                    key={item.lineKey}
                    item={item}
                    onUpdateQty={onUpdateQty}
                    onUpdateNotes={onUpdateNotes}
                    onUpdateCustomization={onUpdateCustomization}
                    onRemove={onRemove}
                    onSplitLine={onSplitLine}
                  />
              ))}
            </ul>

            <div
              className="cart-panel__checkout flex shrink-0 flex-col border-t border-brand/10 bg-[#F7F4EC]/95 backdrop-blur-md sm:border-0 sm:bg-transparent"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            >
              <div className="cart-panel__checkout-intro">
                <p className="cart-panel__checkout-title">
                  Finalização
                </p>
                <p className="cart-panel__checkout-subtitle">
                  Revise os valores e conclua seu pedido.
                </p>
              </div>

              <CartCheckoutOptions
                checkout={checkout}
                pickupAddress={publicConfig.pickupAddress}
                pickupMapsLink={publicConfig.pickupMapsLink}
                pixKey={publicConfig.pixKey}
                subtotalCents={subtotal}
                storeSlug={storeSlug}
                paymentsEnabled={paymentsEnabled}
                cardPaymentsEnabled={cardPaymentsEnabled}
                onChange={handleCheckoutChange}
                paymentSlot={renderPaymentSlot?.(checkout)}
                locked={hidePayActions}
              />

              {(displayError || customizationError) && (
                <p className="cart-panel__checkout-error rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-100">
                  {displayError || customizationError}
                </p>
              )}

              <div className="cart-panel__checkout-summary text-sm">
                <div className="cart-panel__checkout-row flex items-center justify-between gap-3 text-[#5C6B4A]">
                  <span>Subtotal</span>
                  <span className="shrink-0 font-medium tabular-nums text-brand-dark">
                    {formatPrice(productsSubtotal)}
                  </span>
                </div>
                <div className="cart-panel__checkout-divider border-t border-dashed border-brand/15" />
                <div className="cart-panel__checkout-row flex items-center justify-between gap-3 font-bold text-brand-dark">
                  <span>Total</span>
                  <span className="shrink-0 text-lg tabular-nums">
                    {formatPrice(subtotal)}
                  </span>
                </div>
              </div>

              <div className="cart-panel__checkout-actions space-y-2">
                {!hidePayActions &&
                  paymentsEnabled &&
                  cardPaymentsEnabled &&
                  checkout.paymentMethod === "card" &&
                  onCardCheckout && (
                    <button
                      type="button"
                      disabled={paying || Boolean(customizationError)}
                      onClick={handleCardCheckout}
                      className="w-full min-h-[2.9rem] rounded-2xl bg-brand-dark py-3 text-sm font-extrabold text-white shadow-[0_10px_26px_rgba(15,35,28,0.2)] transition-all hover:-translate-y-0.5 hover:bg-brand active:scale-[0.98] touch-manipulation disabled:opacity-50"
                    >
                      {paying ? "Processando…" : "Continuar com cartão"}
                    </button>
                  )}
                {!hidePayActions &&
                  paymentsEnabled &&
                  onCheckout &&
                  checkout.paymentMethod === "pix" && (
                    <button
                      type="button"
                      disabled={paying || Boolean(customizationError)}
                      onClick={handlePixCheckout}
                      className="w-full min-h-[2.9rem] rounded-2xl bg-brand py-3 text-sm font-extrabold text-white shadow-[0_10px_26px_rgba(14,159,110,0.22)] transition-all hover:-translate-y-0.5 hover:bg-brand-dark active:scale-[0.98] touch-manipulation disabled:opacity-50"
                    >
                      {paying ? "Gerando PIX…" : "Gerar QR Code PIX"}
                    </button>
                  )}
                {!hidePayActions && checkout.paymentMethod === "cash" && (
                  <button
                    type="button"
                    disabled={paying || Boolean(customizationError)}
                    onClick={handleWhatsApp}
                    className="w-full min-h-[2.9rem] rounded-2xl bg-[#25D366] py-3 text-sm font-extrabold text-white shadow-[0_10px_26px_rgba(37,211,102,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#20bd5a] active:scale-[0.98] touch-manipulation disabled:opacity-50"
                  >
                    {paying
                      ? "Registrando pedido…"
                      : "Finalizar Pedido no WhatsApp"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
    </div>
  );
}

export function CartSidebar({
  items,
  cartError,
  onUpdateQty,
  onUpdateNotes,
  onUpdateCustomization,
  onRemove,
  onSplitLine,
  onCheckout,
  onCardCheckout,
  onWhatsApp,
  paymentsEnabled,
  cardPaymentsEnabled = false,
  open,
  onOpenChange,
  storeSlug,
}: {
  items: CartItem[];
  cartError: string;
  onUpdateQty: (lineKey: string, qty: number) => void;
  onUpdateNotes: (lineKey: string, notes: string) => void;
  onUpdateCustomization: (
    lineKey: string,
    patch: {
      fieldAnswers?: import("@/lib/party-favor-fields").PartyFavorFieldAnswer[];
      splitInstanceId?: string;
    }
  ) => void;
  onRemove: (lineKey: string) => void;
  onSplitLine?: (lineKey: string) => void;
  onCheckout?: () => void;
  onCardCheckout?: () => void;
  onWhatsApp: (checkout: CartCheckoutState) => void;
  paymentsEnabled: boolean;
  cardPaymentsEnabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug: string;
}) {
  const [visible, setVisible] = useState(open);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timers: number[] = [];

    if (open) {
      timers.push(
        window.setTimeout(() => {
          setIsExiting(false);
          setVisible(true);
        }, 0)
      );
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    if (!visible) return;

    timers.push(window.setTimeout(() => setIsExiting(true), 0));
    timers.push(
      window.setTimeout(() => {
        setVisible(false);
        setIsExiting(false);
      }, 380)
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [open, visible]);

  useEffect(() => {
    if (!visible) return;
    document.body.classList.add("catalog-overlay-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("catalog-overlay-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [visible, onOpenChange]);

  if (!visible) return null;

  const backdropAnimation = isExiting
    ? "animate-cart-backdrop-out motion-reduce:animate-none"
    : "animate-cart-backdrop-in motion-reduce:animate-none";

  const panelAnimation = isExiting
    ? "animate-cart-modal-out motion-reduce:animate-none"
    : "animate-cart-modal-in motion-reduce:animate-none";

  return (
    <div
      className="cart-sidebar fixed inset-0 z-[135] flex items-end justify-center sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className={`absolute inset-0 bg-brand-dark/28 backdrop-blur-md ${backdropAnimation}`}
        onClick={() => onOpenChange(false)}
        aria-label="Fechar carrinho"
      />
      <CartPanelShell className={panelAnimation}>
        <CartPanel
          items={items}
          cartError={cartError}
          onUpdateQty={onUpdateQty}
          onUpdateNotes={onUpdateNotes}
          onUpdateCustomization={onUpdateCustomization}
          onRemove={onRemove}
          onSplitLine={onSplitLine}
          onCheckout={onCheckout}
          onCardCheckout={onCardCheckout}
          onWhatsApp={onWhatsApp}
          paymentsEnabled={paymentsEnabled}
          cardPaymentsEnabled={cardPaymentsEnabled}
          onClose={() => onOpenChange(false)}
          onBrowseProducts={() => onOpenChange(false)}
          storeSlug={storeSlug}
        />
      </CartPanelShell>
    </div>
  );
}
