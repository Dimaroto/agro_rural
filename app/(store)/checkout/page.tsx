import { redirect } from "next/navigation";

/** Checkout intermediário removido — pagamento acontece no carrinho. */
export default function CheckoutPage() {
  redirect("/carrinho");
}
