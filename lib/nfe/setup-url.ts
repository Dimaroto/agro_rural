/** URL pública do Setup Windows. Preferir env; fallback = release GitHub. */
const FALLBACK_SETUP_BLOB =
  "https://github.com/Dimaroto/agro_rural/releases/download/v1.1.6/AgroRural-Setup-1.1.6.exe";

export function getEmissorSetupDownloadUrl(): string {
  return (
    process.env.EMISSOR_SETUP_URL?.trim() ||
    process.env.NEXT_PUBLIC_EMISSOR_SETUP_URL?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_EXE_URL?.trim() ||
    FALLBACK_SETUP_BLOB
  );
}
