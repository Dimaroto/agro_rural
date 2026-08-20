/** URL pública do Setup Windows (Vercel Blob). Só use no servidor. */
const FALLBACK_SETUP_BLOB =
  "https://tixybegl1h3yln4s.public.blob.vercel-storage.com/emissor/AgroRural-Setup.exe";

export function getEmissorSetupDownloadUrl(): string {
  return (
    process.env.EMISSOR_SETUP_URL?.trim() ||
    process.env.NEXT_PUBLIC_EMISSOR_SETUP_URL?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_EXE_URL?.trim() ||
    FALLBACK_SETUP_BLOB
  );
}
