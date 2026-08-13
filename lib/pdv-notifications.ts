/** Preferência local de notificações do PDV (por dispositivo). */
export const PDV_NOTIF_PREF_KEY = "pdv-notifications-pref";
export const PDV_NOTIF_SEEN_KEY = "pdv-notifications-seen";

export type PdvNotifPref = "enabled" | "disabled";

export function readPdvNotifPref(): PdvNotifPref | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(PDV_NOTIF_PREF_KEY);
    if (v === "enabled" || v === "disabled") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function writePdvNotifPref(value: PdvNotifPref) {
  localStorage.setItem(PDV_NOTIF_PREF_KEY, value);
  window.dispatchEvent(
    new CustomEvent("pdv-notif-pref-change", { detail: value })
  );
}

/** IDs já notificados hoje (evita spam a cada abertura). */
export function readNotifiedOrderIdsToday(): Set<string> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(PDV_NOTIF_SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { day?: string; ids?: string[] };
    if (parsed.day !== today) return new Set();
    return new Set(parsed.ids ?? []);
  } catch {
    return new Set();
  }
}

export function markOrdersNotified(ids: string[]) {
  if (ids.length === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const current = readNotifiedOrderIdsToday();
  for (const id of ids) current.add(id);
  localStorage.setItem(
    PDV_NOTIF_SEEN_KEY,
    JSON.stringify({ day: today, ids: [...current] })
  );
}

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}
