import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";
import { DevSwCleanup } from "@/components/DevSwCleanup";
import { FullscreenHotkey } from "@/components/FullscreenHotkey";
import { BrandThemeApplier } from "@/components/BrandThemeApplier";
import { ThemeProvider } from "@/components/ThemeProvider";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { getDefaultStore } from "@/lib/store";
import { brandThemeStyle, parseBrandThemeDocument } from "@/lib/brand-theme";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata: Metadata = {
  title: "SaboArt",
  description: "Catálogo online SaboArt — sabonetes, sachês e sprays",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SaboArt",
  },
};

export const viewport: Viewport = {
  themeColor: "#4A6741",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const serverTheme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const store = await getDefaultStore().catch(() => null);
  const brandTheme = parseBrandThemeDocument(store?.themeJson ?? null);
  const brandStyle = brandThemeStyle(brandTheme);

  return (
    <html
      lang="pt-BR"
      className={`${geist.variable} h-full${serverTheme === "dark" ? " dark" : ""}`}
      style={brandStyle as CSSProperties}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider initialTheme={serverTheme ?? undefined}>
          <BrandThemeApplier theme={brandTheme} />
          <DevSwCleanup />
          <FullscreenHotkey />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
