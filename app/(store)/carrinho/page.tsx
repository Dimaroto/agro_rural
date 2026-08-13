import { notFound } from "next/navigation";
import { CartPageClient } from "@/components/store/CartPageClient";
import { config } from "@/lib/config";
import { getDefaultStore } from "@/lib/store";

export default async function CarrinhoPage() {
  const store = await getDefaultStore();
  if (!store) notFound();

  return (
    <CartPageClient
      storeSlug={store.slug}
      whatsapp={store.whatsapp}
      paymentsEnabled={config.paymentsEnabled}
      cardPaymentsEnabled={config.cardPaymentsEnabled}
      mercadoPagoPublicKey={config.mercadoPagoPublicKey}
    />
  );
}
