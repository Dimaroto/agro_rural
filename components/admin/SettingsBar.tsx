"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { formatApiError } from "@/lib/apiError";
import { MoonIcon, SunIcon } from "@/components/icons/UiIcons";
import {
  notificationsSupported,
  readPdvNotifPref,
  type PdvNotifPref,
} from "@/lib/pdv-notifications";
import { BannerImageField } from "@/components/admin/BannerImageField";
import { useUnsavedChangesOptional } from "@/components/admin/UnsavedChangesContext";

type SettingsBarProps = {
  initialWhatsapp?: string | null;
  initialBannerUrl?: string | null;
};

export function SettingsBar({
  initialWhatsapp,
  initialBannerUrl,
}: SettingsBarProps) {
  const { theme, setTheme, mounted } = useTheme();
  const router = useRouter();
  const unsaved = useUnsavedChangesOptional();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const [whatsapp, setWhatsapp] = useState(initialWhatsapp ?? "");
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [whatsappError, setWhatsappError] = useState("");
  const [notifPref, setNotifPref] = useState<PdvNotifPref | null>(null);
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const [isDesktop, setIsDesktop] = useState(false);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [autostartMsg, setAutostartMsg] = useState("");

  const showStoreSettings = initialWhatsapp !== undefined;
  const showNotifSettings = notificationsSupported();

  useEffect(() => {
    const desktop = (
      window as Window & {
        agroDesktop?: {
          isDesktop?: boolean;
          getAutostart?: () => Promise<{ enabled?: boolean }>;
          setAutostart?: (
            enabled: boolean
          ) => Promise<{ enabled?: boolean }>;
        };
      }
    ).agroDesktop;
    const canAutostart = Boolean(
      desktop?.isDesktop && desktop.getAutostart && desktop.setAutostart
    );
    setIsDesktop(canAutostart);
    if (!canAutostart || !desktop?.getAutostart) return;
    void desktop
      .getAutostart()
      .then((r) => setAutostart(Boolean(r?.enabled)))
      .catch(() => setAutostart(false));
  }, []);

  useEffect(() => {
    setWhatsapp(initialWhatsapp ?? "");
  }, [initialWhatsapp]);

  useEffect(() => {
    setBannerUrl(initialBannerUrl ?? null);
  }, [initialBannerUrl]);

  useEffect(() => {
    if (!notificationsSupported()) {
      setNotifPermission("unsupported");
      return;
    }
    setNotifPref(readPdvNotifPref());
    setNotifPermission(Notification.permission);

    function onPref(e: Event) {
      const detail = (e as CustomEvent<PdvNotifPref>).detail;
      setNotifPref(detail);
    }
    window.addEventListener("pdv-notif-pref-change", onPref);
    return () => window.removeEventListener("pdv-notif-pref-change", onPref);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function saveWhatsapp() {
    setSaving(true);
    setWhatsappMsg("");
    setWhatsappError("");

    const res = await fetch("/api/admin/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsapp }),
    });

    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setWhatsappError(formatApiError(data.error, "Erro ao salvar"));
      return;
    }

    setWhatsapp(data.whatsapp ?? "");
    setWhatsappMsg("Número salvo!");
    router.refresh();
  }

  const notifEnabled =
    notifPref !== "disabled" && notifPermission === "granted";

  async function toggleAutostart(enabled: boolean) {
    const desktop = (
      window as Window & {
        agroDesktop?: {
          setAutostart?: (
            enabled: boolean
          ) => Promise<{ enabled?: boolean }>;
        };
      }
    ).agroDesktop;
    if (!desktop?.setAutostart) return;
    setAutostartBusy(true);
    setAutostartMsg("");
    try {
      const r = await desktop.setAutostart(enabled);
      setAutostart(Boolean(r?.enabled));
      setAutostartMsg(
        r?.enabled
          ? "Ativado: o Agro Rural e o emissor iniciam com o Windows."
          : "Desativado: não inicia mais com o Windows."
      );
    } catch (err) {
      setAutostartMsg(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar a inicialização."
      );
    } finally {
      setAutostartBusy(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-label="Configurações"
        aria-expanded={open}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-5rem)] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg min-[520px]:w-[min(46rem,calc(100vw-2rem))] dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Configurações
          </p>

          <div className="mt-4 grid gap-4 min-[520px]:grid-cols-2 md:grid-cols-3">
          {showStoreSettings && (
            <div className="border-b border-zinc-100 pb-4 min-[520px]:border-b-0 min-[520px]:border-r min-[520px]:pr-4 min-[520px]:pb-0 dark:border-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                WhatsApp
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Número que recebe pedidos do catálogo
              </p>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => {
                  setWhatsapp(e.target.value);
                  setWhatsappMsg("");
                  setWhatsappError("");
                }}
                placeholder="554984376190"
                className="admin-input mt-2 w-full py-2 text-sm"
              />
              <p className="mt-1 text-[10px] text-zinc-400">
                DDI + DDD + número, só dígitos
              </p>
              {whatsappError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {whatsappError}
                </p>
              )}
              {whatsappMsg && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                  {whatsappMsg}
                </p>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={saveWhatsapp}
                className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar número"}
              </button>
            </div>
          )}

          <div className="border-b border-zinc-100 pb-4 min-[520px]:border-b-0 min-[520px]:border-r min-[520px]:pr-4 min-[520px]:pb-0 dark:border-zinc-800">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Notificações
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Defina quais alertas do PDV, pedidos, estoque e financeiro ficam
              ativos.
            </p>
            {showNotifSettings && (
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                Navegador:{" "}
                {notifEnabled
                  ? "liberado"
                  : notifPref === "disabled"
                    ? "desativado"
                    : notifPermission === "denied"
                      ? "bloqueado"
                      : "aguardando permissão"}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (unsaved?.isDirty) {
                  unsaved.requestNavigation({
                    type: "href",
                    href: "/admin/notificacoes",
                  });
                  return;
                }
                router.push("/admin/notificacoes");
              }}
              className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold text-zinc-800 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
            >
              Configurar notificações
            </button>
          </div>

          <div className="min-[520px]:col-span-2 md:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Aparência
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ThemeOption
                label="Claro"
                icon={<SunIcon className="h-5 w-5" />}
                active={mounted && theme === "light"}
                onClick={() => setTheme("light")}
              />
              <ThemeOption
                label="Escuro"
                icon={<MoonIcon className="h-5 w-5" />}
                active={mounted && theme === "dark"}
                onClick={() => setTheme("dark")}
              />
            </div>
          </div>
          </div>

          {isDesktop ? (
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Windows
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Iniciar o Agro Rural e o emissor NF-e junto com o Windows.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={autostartBusy || autostart === true}
                  onClick={() => void toggleAutostart(true)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                    autostart
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  Ativar
                </button>
                <button
                  type="button"
                  disabled={autostartBusy || autostart === false}
                  onClick={() => void toggleAutostart(false)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                    autostart === false
                      ? "border-zinc-400 bg-zinc-100 text-zinc-800 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100"
                      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  Desativar
                </button>
              </div>
              {autostartMsg ? (
                <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                  {autostartMsg}
                </p>
              ) : null}
            </div>
          ) : null}

          {showStoreSettings && (
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Cores do site
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Header, botões, fundo e predefinições do catálogo.
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (unsaved?.isDirty) {
                    unsaved.requestNavigation({
                      type: "href",
                      href: "/admin/cores",
                    });
                    return;
                  }
                  router.push("/admin/cores");
                }}
                className="mt-3 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold text-zinc-800 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              >
                Configurar cores
              </button>
            </div>
          )}

          {showStoreSettings && (
            <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <BannerImageField
                currentUrl={bannerUrl}
                onSaved={(url) => {
                  setBannerUrl(url);
                  router.refresh();
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThemeOption({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm transition ${
        active
          ? "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
