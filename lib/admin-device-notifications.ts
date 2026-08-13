"use client";

import {
  readAdminNotifSettings,
  type AdminNotifSettings,
} from "@/lib/admin-notification-prefs";
import {
  notificationsSupported,
  writePdvNotifPref,
} from "@/lib/pdv-notifications";

export async function ensureAdminServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/admin/",
    });
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function syncPushSubscription(settings?: AdminNotifSettings) {
  if (!notificationsSupported()) return null;
  if (Notification.permission !== "granted") return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const meta = await fetch("/api/admin/push/subscribe").then((r) => r.json());
  if (!meta?.configured || !meta.publicKey) return null;

  const reg = await ensureAdminServiceWorker();
  if (!reg) return null;

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(meta.publicKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;

  const prefs = settings ?? readAdminNotifSettings();
  await fetch("/api/admin/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      prefs: {
        alerts: prefs.alerts,
      },
      userAgent: navigator.userAgent,
    }),
  });

  return subscription;
}

export async function updatePushPrefsOnServer(settings: AdminNotifSettings) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/admin/push/subscribe", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      prefs: {
        alerts: settings.alerts,
      },
    }),
  }).catch(() => null);
}

export async function unsubscribePush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/admin/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => null);

  await subscription.unsubscribe().catch(() => null);
}

export async function enableDeviceNotifications() {
  if (!notificationsSupported()) {
    throw new Error("Este navegador não suporta notificações");
  }

  writePdvNotifPref("enabled");

  if (Notification.permission === "denied") {
    throw new Error(
      "O navegador bloqueou. Libere as notificações nas configurações do site."
    );
  }

  if (Notification.permission !== "granted") {
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      throw new Error("Permissão de notificação não concedida");
    }
  }

  await ensureAdminServiceWorker();
  await syncPushSubscription(readAdminNotifSettings());
}

export async function disableDeviceNotifications() {
  writePdvNotifPref("disabled");
  await unsubscribePush();
}
