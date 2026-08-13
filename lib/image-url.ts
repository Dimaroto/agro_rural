/** URL de foto enviada pelo admin (disco local ou Vercel Blob). */
export function isPhotoImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("/uploads/")) return true;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  return false;
}

/** Qualquer imagem exibível (foto, blob ou asset estático do projeto). */
export function hasDisplayImage(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  return url.startsWith("/");
}
