"use client";

import { useEffect } from "react";
import {
  applyBrandThemeToDocument,
  parseBrandTheme,
  type BrandTheme,
} from "@/lib/brand-theme";

export function BrandThemeApplier({
  theme,
}: {
  theme?: BrandTheme | string | null;
}) {
  const parsed = parseBrandTheme(theme ?? null);
  const key = `${parsed.mode}|${parsed.from}|${parsed.to}|${parsed.shape}|${parsed.angle}`;

  useEffect(() => {
    applyBrandThemeToDocument(parsed);
  }, [key]);

  return null;
}
