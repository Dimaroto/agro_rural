"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function DevSwCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    // Mantém o SW do PDV ativo para testar notificações.
    if (pathname?.startsWith("/admin/pdv")) return;

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }

    if ("caches" in window) {
      void caches.keys().then((keys) => {
        keys.forEach((k) => caches.delete(k));
      });
    }
  }, [pathname]);

  return null;
}
