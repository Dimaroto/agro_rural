"use client";

import { useEffect } from "react";
import {
  applyBrandThemeToDocument,
  parseBrandThemeDocument,
  type BrandThemeDocument,
} from "@/lib/brand-theme";

export function BrandThemeApplier({
  theme,
}: {
  theme?: BrandThemeDocument | string | null;
}) {
  const key = JSON.stringify(parseBrandThemeDocument(theme ?? null));

  useEffect(() => {
    applyBrandThemeToDocument(theme ?? null);
  }, [key, theme]);

  return null;
}
