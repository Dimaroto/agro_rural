"use client";

import { useEffect, useState } from "react";
import {
  ADMIN_NOTIFICATIONS,
  groupNotificationsByCategory,
  readAdminNotifSettings,
  writeAdminNotifSettings,
  type AdminNotificationId,
  type AdminNotifSettings,
} from "@/lib/admin-notification-prefs";
import {
  notificationsSupported,
  readPdvNotifPref,
  type PdvNotifPref,
} from "@/lib/pdv-notifications";
import {
  disableDeviceNotifications,
  enableDeviceNotifications,
  updatePushPrefsOnServer,
} from "@/lib/admin-device-notifications";

export function NotificationSettingsForm() {
  const [settings, setSettings] = useState<AdminNotifSettings | null>(null);
  const [masterPref, setMasterPref] = useState<PdvNotifPref | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSettings(readAdminNotifSettings());
    if (!notificationsSupported()) {
      setPermission("unsupported");
      return;
    }
    setMasterPref(readPdvNotifPref());
    setPermission(Notification.permission);

    function onPrefs(e: Event) {
      setSettings((e as CustomEvent<AdminNotifSettings>).detail);
    }
    function onMaster(e: Event) {
      setMasterPref((e as CustomEvent<PdvNotifPref>).detail);
    }
    window.addEventListener("admin-notif-prefs-change", onPrefs);
    window.addEventListener("pdv-notif-pref-change", onMaster);
    return () => {
      window.removeEventListener("admin-notif-prefs-change", onPrefs);
      window.removeEventListener("pdv-notif-pref-change", onMaster);
    };
  }, []);

  const masterEnabled =
    masterPref !== "disabled" && permission === "granted";

  function persist(next: AdminNotifSettings) {
    setSettings(next);
    writeAdminNotifSettings(next);
    void updatePushPrefsOnServer(next);
  }

  async function enableMaster() {
    setBusy(true);
    setMessage("");
    try {
      await enableDeviceNotifications();
      setPermission(Notification.permission);
      setMasterPref("enabled");
      setMessage(
        "Notificações ativadas neste dispositivo. Os eventos selecionados serão enviados na hora."
      );
    } catch (err) {
      setPermission(
        notificationsSupported() ? Notification.permission : "unsupported"
      );
      setMessage(
        err instanceof Error ? err.message : "Não foi possível ativar."
      );
    } finally {
      setBusy(false);
    }
  }

  async function disableMaster() {
    setBusy(true);
    setMessage("");
    try {
      await disableDeviceNotifications();
      setMasterPref("disabled");
      setMessage("Notificações desativadas neste dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: AdminNotificationId, enabled: boolean) {
    if (!settings) return;
    persist({
      ...settings,
      alerts: { ...settings.alerts, [id]: enabled },
    });
  }

  function enableAll() {
    if (!settings) return;
    const alerts = { ...settings.alerts };
    for (const item of ADMIN_NOTIFICATIONS) alerts[item.id] = true;
    persist({ ...settings, alerts });
  }

  function disableAll() {
    if (!settings) return;
    const alerts = { ...settings.alerts };
    for (const item of ADMIN_NOTIFICATIONS) alerts[item.id] = false;
    persist({ ...settings, alerts });
  }

  if (!settings) {
    return (
      <div className="admin-card p-6 text-sm text-zinc-500 dark:text-zinc-400">
        Carregando preferências…
      </div>
    );
  }

  const groups = groupNotificationsByCategory();
  const activeCount = ADMIN_NOTIFICATIONS.filter(
    (n) => settings.alerts[n.id]
  ).length;

  return (
    <div className="space-y-5">
      <section className="admin-card p-4 sm:p-5">
        <h2 className="admin-section-title">Este dispositivo</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          As notificações vão para o aparelho que ativar. Com permissão liberada,
          cada evento selecionado é enviado na hora, mesmo com o navegador em
          segundo plano.
        </p>
        <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
          Status:{" "}
          <span className="font-medium">
            {permission === "unsupported"
              ? "Não suportado neste navegador"
              : masterEnabled
                ? "Ativado neste aparelho"
                : masterPref === "disabled"
                  ? "Desativado"
                  : permission === "denied"
                    ? "Bloqueado pelo navegador"
                    : "Aguardando permissão"}
          </span>
        </p>
        {message && (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
            {message}
          </p>
        )}
        {permission !== "unsupported" && (
          <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void enableMaster()}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                masterEnabled
                  ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              Ativar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void disableMaster()}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                masterPref === "disabled"
                  ? "border-zinc-500 bg-zinc-100 text-zinc-800 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-200"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
              }`}
            >
              Desativar
            </button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {activeCount} de {ADMIN_NOTIFICATIONS.length} ativas
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={enableAll}
            className="admin-btn-secondary px-3 py-2 text-xs"
          >
            Ativar todas
          </button>
          <button
            type="button"
            onClick={disableAll}
            className="admin-btn-secondary px-3 py-2 text-xs"
          >
            Desativar todas
          </button>
        </div>
      </div>

      {groups.map(([category, items]) => (
        <section key={category} className="admin-card p-4 sm:p-5">
          <h2 className="admin-section-title">{category}</h2>
          <ul className="mt-3 space-y-3">
            {items.map((item) => {
              const enabled = settings.alerts[item.id];
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                        {item.description}
                      </p>
                    </div>
                    <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-44">
                      <button
                        type="button"
                        onClick={() => toggle(item.id, true)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          enabled
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "border-zinc-200 text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                      >
                        Ativa
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(item.id, false)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          !enabled
                            ? "border-zinc-500 bg-zinc-100 text-zinc-800 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-200"
                            : "border-zinc-200 text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        }`}
                      >
                        Inativa
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
