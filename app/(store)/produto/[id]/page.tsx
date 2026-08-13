import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Página individual removida — redireciona para a home. */
export default async function ProductPageRedirect({ params }: Props) {
  await params;
  redirect("/");
}
