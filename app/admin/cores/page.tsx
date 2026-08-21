import { redirect } from "next/navigation";

/** Rota antiga — redireciona para Configurar layout. */
export default function CoresRedirectPage() {
  redirect("/admin/aparencia");
}
