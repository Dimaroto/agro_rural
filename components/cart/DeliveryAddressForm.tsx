import type { StructuredAddress } from "@/lib/address";

const inputClassName =
  "w-full rounded-xl border border-brand/15 bg-[#f4fbf7]/85 px-3 py-2.5 text-sm text-brand-dark placeholder:text-[#5C6B4A]/60 shadow-inner focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

const labelClassName =
  "mb-1.5 block text-sm font-medium text-[#5C6B4A]";

type DeliveryAddressFormProps = {
  value: StructuredAddress;
  onChange: (patch: Partial<StructuredAddress>) => void;
};

export function DeliveryAddressForm({ value, onChange }: DeliveryAddressFormProps) {
  return (
    <div className="cart-checkout__delivery-form space-y-3">
      <p className="text-sm font-semibold text-brand-dark">Endereço de entrega</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="delivery-street" className={labelClassName}>
            Rua
          </label>
          <input
            id="delivery-street"
            type="text"
            value={value.street}
            onChange={(e) => onChange({ street: e.target.value })}
            placeholder="Ex.: Rua das Flores"
            className={inputClassName}
            autoComplete="street-address"
          />
        </div>

        <div>
          <label htmlFor="delivery-number" className={labelClassName}>
            Número
          </label>
          <input
            id="delivery-number"
            type="text"
            inputMode="numeric"
            value={value.number}
            onChange={(e) => onChange({ number: e.target.value })}
            placeholder="Ex.: 123"
            className={inputClassName}
          />
        </div>

        <div>
          <label htmlFor="delivery-neighborhood" className={labelClassName}>
            Bairro
          </label>
          <input
            id="delivery-neighborhood"
            type="text"
            value={value.neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
            placeholder="Ex.: Centro"
            className={inputClassName}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="delivery-city" className={labelClassName}>
            Cidade
          </label>
          <input
            id="delivery-city"
            type="text"
            value={value.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Ex.: Zortéa - SC"
            className={inputClassName}
            autoComplete="address-level2"
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="delivery-complement" className={labelClassName}>
            Complemento <span className="font-normal text-[#6B7280]">(opcional)</span>
          </label>
          <input
            id="delivery-complement"
            type="text"
            value={value.complement}
            onChange={(e) => onChange({ complement: e.target.value })}
            placeholder="Apto, bloco, referência…"
            className={inputClassName}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="delivery-maps" className={labelClassName}>
            Link do Google Maps <span className="font-normal text-[#6B7280]">(opcional)</span>
          </label>
          <input
            id="delivery-maps"
            type="url"
            value={value.mapsLink}
            onChange={(e) => onChange({ mapsLink: e.target.value })}
            placeholder="https://maps.google.com/…"
            className={inputClassName}
          />
        </div>
      </div>
    </div>
  );
}
