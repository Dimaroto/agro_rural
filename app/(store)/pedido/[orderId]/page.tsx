import { Suspense } from "react";
import OrderPageClient from "./OrderPageClient";

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-zinc-600">Carregando pedido…</div>
      }
    >
      <OrderPageClient />
    </Suspense>
  );
}
