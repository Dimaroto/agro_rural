"use client";

import type { CartCheckoutState, PaymentMethod } from "@/lib/cart-checkout";
import { FULFILLMENT_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/cart-checkout";
import { DeliveryAddressForm } from "@/components/cart/DeliveryAddressForm";
import { PixQrCode } from "./PixQrCode";
import type { ReactNode } from "react";

type CartCheckoutOptionsProps = {
  checkout: CartCheckoutState;
  pickupAddress: string;
  pickupMapsLink?: string;
  pixKey: string;
  subtotalCents: number;
  storeSlug: string;
  paymentsEnabled?: boolean;
  cardPaymentsEnabled?: boolean;
  onChange: (patch: Partial<CartCheckoutState>) => void;
  /** Conteúdo de pagamento online (QR PIX / formulário cartão) injetado no carrinho. */
  paymentSlot?: ReactNode;
  /** Após pagamento confirmado: só mostra o slot de sucesso. */
  locked?: boolean;
};

function OptionGroup<T extends string>({
  legend,
  name,
  value,
  options,
  labels,
  onChange,
  disabled = false,
}: {
  legend: string;
  name: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="cart-checkout__field" disabled={disabled}>
      <legend className="cart-checkout__legend">{legend}</legend>
      <div className="cart-checkout__options">
        {options.map((option) => (
          <label key={option} className="cart-checkout__option">
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="cart-checkout__radio"
            />
            <span>{labels[option]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CartCheckoutOptions({
  checkout,
  pickupAddress,
  pickupMapsLink,
  pixKey,
  subtotalCents,
  paymentsEnabled = false,
  cardPaymentsEnabled = false,
  onChange,
  paymentSlot,
  locked = false,
}: CartCheckoutOptionsProps) {
  const paymentOptions: PaymentMethod[] = paymentsEnabled
    ? cardPaymentsEnabled
      ? ["cash", "pix", "card"]
      : ["cash", "pix"]
    : ["cash"];

  if (locked) {
    return <div className="cart-checkout__options-wrap">{paymentSlot}</div>;
  }

  return (
    <div className="cart-checkout__options-wrap space-y-4">
      <OptionGroup
        legend="Como deseja receber?"
        name="fulfillment"
        value={checkout.fulfillmentType}
        options={["pickup", "delivery"] as const}
        labels={FULFILLMENT_LABELS}
        onChange={(fulfillmentType) => onChange({ fulfillmentType })}
      />

      {checkout.fulfillmentType === "pickup" ? (
        <div className="cart-checkout__address-box rounded-xl border border-brand/15 bg-white/70 px-4 py-3 text-sm text-[#5C6B4A]">
          <p className="mb-1.5 text-sm font-semibold text-brand-dark">
            Endereço para retirada
          </p>
          <p className="leading-relaxed">{pickupAddress}</p>
          {pickupMapsLink ? (
            <a
              href={pickupMapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex text-sm font-semibold text-brand underline-offset-2 hover:underline"
            >
              Abrir no Google Maps
            </a>
          ) : null}
        </div>
      ) : (
        <DeliveryAddressForm
          value={checkout.deliveryAddress}
          onChange={(patch) =>
            onChange({
              deliveryAddress: { ...checkout.deliveryAddress, ...patch },
            })
          }
        />
      )}

      <OptionGroup
        legend="Forma de pagamento"
        name="payment"
        value={
          paymentOptions.includes(checkout.paymentMethod)
            ? checkout.paymentMethod
            : "cash"
        }
        options={paymentOptions}
        labels={PAYMENT_METHOD_LABELS}
        onChange={(paymentMethod) =>
          onChange({ paymentMethod: paymentMethod as PaymentMethod })
        }
      />

      {!paymentsEnabled && checkout.paymentMethod === "pix" && (
        <PixQrCode amountCents={subtotalCents} pixKey={pixKey} />
      )}

      {paymentSlot}
    </div>
  );
}
