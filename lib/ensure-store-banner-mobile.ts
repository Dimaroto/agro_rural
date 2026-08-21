import { prisma } from "@/lib/db";

let ensurePromise: Promise<void> | null = null;

/**
 * Garante a coluna bannerUrlMobile em stores (deploy pode chegar
 * antes do db push no Neon da Vercel).
 */
export function ensureStoreBannerMobileColumn() {
  if (!ensurePromise) {
    ensurePromise = prisma
      .$executeRawUnsafe(
        `ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "bannerUrlMobile" TEXT`
      )
      .then(() => undefined)
      .catch((err) => {
        ensurePromise = null;
        throw err;
      });
  }
  return ensurePromise;
}
