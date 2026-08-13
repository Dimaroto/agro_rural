"use client";

import type { ComponentProps } from "react";
import { CatalogView } from "@/components/catalog/CatalogView";

/** Catálogo com SSR — evita skeleton + hidratação tardia no mobile. */
export function CatalogLoader(props: ComponentProps<typeof CatalogView>) {
  return <CatalogView {...props} />;
}
