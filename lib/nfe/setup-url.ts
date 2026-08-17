/** URL pública do Setup Windows (Vercel Blob). Só use no servidor. */

export function getEmissorSetupDownloadUrl(): string {
  return (
    process.env.EMISSOR_SETUP_URL?.trim() ||
    process.env.NEXT_PUBLIC_EMISSOR_SETUP_URL?.trim() ||
    ""
  );
}
