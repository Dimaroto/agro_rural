/** Preferências granulares de notificações do admin (por dispositivo). */

export const ADMIN_NOTIF_PREFS_KEY = "admin-notification-prefs";

export type AdminNotificationId =
  | "new_online_order"
  | "pix_payment_confirmed"
  | "card_payment_confirmed"
  | "order_cancelled"
  | "low_stock"
  | "out_of_stock";

export type AdminNotificationDef = {
  id: AdminNotificationId;
  title: string;
  description: string;
  category: string;
  /** Padrão ao abrir pela primeira vez. */
  defaultEnabled: boolean;
};

export const ADMIN_NOTIFICATIONS: AdminNotificationDef[] = [
  {
    id: "new_online_order",
    title: "Novo pedido no catálogo",
    description:
      "Quando um cliente finaliza um pedido pela loja online.",
    category: "Vendas",
    defaultEnabled: true,
  },
  {
    id: "pix_payment_confirmed",
    title: "PIX confirmado",
    description:
      "Quando o pagamento PIX de um pedido é aprovado.",
    category: "Vendas",
    defaultEnabled: true,
  },
  {
    id: "card_payment_confirmed",
    title: "Cartão aprovado",
    description:
      "Quando o pagamento com cartão é confirmado pelo provedor.",
    category: "Vendas",
    defaultEnabled: true,
  },
  {
    id: "order_cancelled",
    title: "Venda cancelada",
    description:
      "Quando um pedido é cancelado ou o PIX expira sem pagamento.",
    category: "Vendas",
    defaultEnabled: true,
  },
  {
    id: "low_stock",
    title: "Estoque baixo",
    description:
      "Quando um produto fica com poucas unidades.",
    category: "Estoque",
    defaultEnabled: true,
  },
  {
    id: "out_of_stock",
    title: "Produto esgotado",
    description:
      "Quando o estoque disponível chega a zero.",
    category: "Estoque",
    defaultEnabled: true,
  },
];

export type AdminNotifPrefs = Record<AdminNotificationId, boolean>;

export type AdminNotifSettings = {
  alerts: AdminNotifPrefs;
};

export function defaultAdminNotifPrefs(): AdminNotifPrefs {
  const prefs = {} as AdminNotifPrefs;
  for (const item of ADMIN_NOTIFICATIONS) {
    prefs[item.id] = item.defaultEnabled;
  }
  return prefs;
}

export function defaultAdminNotifSettings(): AdminNotifSettings {
  return {
    alerts: defaultAdminNotifPrefs(),
  };
}

export function readAdminNotifSettings(): AdminNotifSettings {
  const defaults = defaultAdminNotifSettings();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(ADMIN_NOTIF_PREFS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as
      | AdminNotifSettings
      | Partial<Record<string, boolean>>;

    if (
      parsed &&
      typeof parsed === "object" &&
      "alerts" in parsed &&
      parsed.alerts &&
      typeof parsed.alerts === "object"
    ) {
      const alerts = { ...defaults.alerts };
      for (const item of ADMIN_NOTIFICATIONS) {
        if (typeof parsed.alerts[item.id] === "boolean") {
          alerts[item.id] = parsed.alerts[item.id]!;
        }
      }
      return { alerts };
    }

    // Formato antigo: mapa plano de booleanos
    const alerts = { ...defaults.alerts };
    for (const item of ADMIN_NOTIFICATIONS) {
      if (typeof (parsed as Record<string, boolean>)[item.id] === "boolean") {
        alerts[item.id] = (parsed as Record<string, boolean>)[item.id]!;
      }
    }
    return { alerts };
  } catch {
    return defaults;
  }
}

/** @deprecated use readAdminNotifSettings().alerts */
export function readAdminNotifPrefs(): AdminNotifPrefs {
  return readAdminNotifSettings().alerts;
}

export function writeAdminNotifSettings(settings: AdminNotifSettings) {
  const normalized: AdminNotifSettings = {
    alerts: { ...defaultAdminNotifPrefs(), ...settings.alerts },
  };
  localStorage.setItem(ADMIN_NOTIF_PREFS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(
    new CustomEvent("admin-notif-prefs-change", { detail: normalized })
  );
}

/** @deprecated use writeAdminNotifSettings */
export function writeAdminNotifPrefs(prefs: AdminNotifPrefs) {
  const current = readAdminNotifSettings();
  writeAdminNotifSettings({ ...current, alerts: prefs });
}

export function isAdminNotifEnabled(id: AdminNotificationId): boolean {
  return readAdminNotifSettings().alerts[id] ?? true;
}

export function groupNotificationsByCategory() {
  const map = new Map<string, AdminNotificationDef[]>();
  for (const item of ADMIN_NOTIFICATIONS) {
    const list = map.get(item.category) ?? [];
    list.push(item);
    map.set(item.category, list);
  }
  return [...map.entries()];
}

export function settingsPayloadForServer(settings: AdminNotifSettings) {
  return {
    alerts: settings.alerts,
  };
}
