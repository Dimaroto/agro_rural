import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PdvClient } from "@/components/admin/PdvClient";

export const metadata: Metadata = {
  title: "PDV | SaboArt",
  description: "Venda presencial e controle de estoque",
  manifest: "/pdv-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PDV SaboArt",
  },
};

export default async function PdvPage() {
  const session = await auth();
  if (!session?.user?.storeId) redirect("/admin/login");

  return <PdvClient />;
}
