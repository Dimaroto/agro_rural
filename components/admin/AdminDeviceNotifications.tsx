"use client";

import { useCallback, useEffect, useState } from "react";
import {
  enableDeviceNotifications,
  ensureAdminServiceWorker,
  syncPushSubscription,
} from "@/lib/admin-device-notifications";
import {
  notificationsSupported,
  readPdvNotifPref,
} from "@/lib/pdv-notifications";
import { readAdminNotifSettings } from "@/lib/admin-notification-prefs";

/**
 * Roda em todo o admin: registra o Service Worker e mantém a inscrição
 * Web Push deste dispositivo sincronizada.
 */
export function AdminDeviceNotifications() {
  const [banner, setBanner] = useState<"ask" | "denied" | null>(null);

  const syncDevice = useCallback(async () => {
    const pref = readPdvNotifPref();
    if (pref === "disabled") return;
    if (!notificationsSupported()) return;
    if (Notification.permission !== "granted") return;

    await ensureAdminServiceWorker();
    await syncPushSubscription(readAdminNotifSettings()).catch(() => null);
  }, []);

  const requestFlow = useCallback(async () => {
    if (!notificationsSupported()) return;
    const pref = readPdvNotifPref();
    if (pref === "disabled") {
      setBanner(null);
      return;
    }

    if (Notification.permission === "granted") {
      setBanner(null);
      await syncDevice();
      return;
    }

    if (Notification.permission === "denied") {
      setBanner("denied");
      return;
    }

    setBanner("ask");
  }, [syncDevice]);

  useEffect(() => {
    void ensureAdminServiceWorker();
    void requestFlow();

    const onPref = () => {
      void requestFlow();
    };
    window.addEventListener("pdv-notif-pref-change", onPref);
    window.addEventListener("admin-notif-prefs-change", onPref);

    return () => {
      window.removeEventListener("pdv-notif-pref-change", onPref);
      window.removeEventListener("admin-notif-prefs-change", onPref);
    };
  }, [requestFlow]);

  if (!banner) return null;

  return (
    <div className="mx-auto mb-4 max-w-5xl px-3 sm:px-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        {banner === "ask" ? (
          <>
            <p className="font-medium">Ative as notificações neste dispositivo</p>
            <p className="mt-1 text-xs opacity-90">
              Os eventos que você selecionar serão enviados para este aparelho
              assim que acontecerem.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void enableDeviceNotifications()
                    .then(() => setBanner(null))
                    .catch(() => setBanner("ask"));
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Permitir neste aparelho
              </button>
              <button
                type="button"
                onClick={() => {
                  void import("@/lib/admin-device-notifications").then((m) =>
                    m.disableDeviceNotifications()
                  );
                  setBanner(null);
                }}
                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40"
              >
                Agora não
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-medium">Notificações bloqueadas no navegador</p>
            <p className="mt-1 text-xs opacity-90">
              Libere nas configurações do site e depois ative em Configurar
              notificações.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
