/** URL pública do APK Android (Vercel Blob). Só use no servidor. */
const FALLBACK_APK_BLOB =
  "https://tixybegl1h3yln4s.public.blob.vercel-storage.com/admin/AgroRural-Admin.apk";

export function getAdminApkDownloadUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ADMIN_APK_URL?.trim() ||
    process.env.ADMIN_APK_URL?.trim() ||
    FALLBACK_APK_BLOB
  );
}
