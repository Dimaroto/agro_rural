/** Cookie / header que libera a UI completa do admin nos apps. */
export const AGRO_APP_CLIENT_COOKIE = "agro_app_client";
export const AGRO_APP_CLIENT_HEADER = "x-agro-client";

export type AgroAppClient = "desktop" | "mobile";

export function parseAgroAppClient(
  value: string | null | undefined
): AgroAppClient | null {
  if (value === "desktop" || value === "mobile") return value;
  return null;
}

/** Rotas do admin liberadas no browser (portal + login). Demais exigem app. */
export function isAdminWebAllowedPath(pathname: string): boolean {
  if (pathname === "/admin" || pathname === "/admin/") return true;
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return true;
  }
  if (pathname.startsWith("/admin/download")) return true;
  return false;
}

export function detectDownloadPlatform(userAgent: string): {
  platform: "windows" | "android" | "ios" | "other";
  label: string;
  filename: string | null;
} {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) {
    return {
      platform: "ios",
      label: "iPhone / iPad",
      filename: null,
    };
  }
  if (/android/.test(ua)) {
    return {
      platform: "android",
      label: "Android",
      filename: "AgroRural-Admin.apk",
    };
  }
  if (/windows|win64|win32|wow64/.test(ua) || /macintosh|mac os x/.test(ua)) {
    // Mac/other desktop: oferecer Windows por enquanto (único instalador desktop)
    return {
      platform: "windows",
      label: /macintosh|mac os x/.test(ua) ? "Desktop" : "Windows",
      filename: "AgroRural-Admin-Setup.exe",
    };
  }
  return {
    platform: "other",
    label: "Seu dispositivo",
    filename: "AgroRural-Admin-Setup.exe",
  };
}

export function resolveDownloadUrl(
  filename: string | null,
  platform: "windows" | "android" | "ios" | "other"
): string | null {
  if (!filename) return null;
  if (platform === "android") {
    return (
      process.env.NEXT_PUBLIC_ADMIN_APK_URL?.trim() ||
      `/downloads/${filename}`
    );
  }
  return (
    process.env.NEXT_PUBLIC_ADMIN_EXE_URL?.trim() || `/downloads/${filename}`
  );
}
