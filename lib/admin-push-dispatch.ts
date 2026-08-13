import { prisma } from "@/lib/db";
import type { AdminNotificationId } from "@/lib/admin-notification-prefs";
import { ADMIN_NOTIFICATIONS } from "@/lib/admin-notification-prefs";
import { availableStock } from "@/lib/inventory";
import { sendWebPush, vapidConfigured } from "@/lib/web-push";

export type AdminNotificationEvent = {
  storeId: string;
  type: AdminNotificationId;
  /** Chave estável do evento para impedir envio duplicado por webhook/retry. */
  eventId: string;
  title: string;
  body: string;
  url: string;
  tag?: string;
};

type StoredPrefs = {
  alerts?: Partial<Record<AdminNotificationId, boolean>>;
};

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isEnabled(
  prefs: StoredPrefs,
  type: AdminNotificationId
): boolean {
  const explicit = prefs.alerts?.[type];
  if (typeof explicit === "boolean") return explicit;
  const definition = ADMIN_NOTIFICATIONS.find((item) => item.id === type);
  return definition?.defaultEnabled ?? false;
}

function pruneEventMap(map: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 500)
  );
}

/**
 * Envia um evento real para todos os dispositivos inscritos da loja.
 * Nunca lança erro para não interromper venda, pagamento ou estoque.
 */
export async function dispatchAdminNotification(
  event: AdminNotificationEvent
) {
  try {
    return await dispatchAdminNotificationUnsafe(event);
  } catch {
    return { sent: 0, skipped: "send_error" as const };
  }
}

async function dispatchAdminNotificationUnsafe(
  event: AdminNotificationEvent
) {
  if (!vapidConfigured()) {
    return { sent: 0, skipped: "vapid_missing" as const };
  }

  const subscriptions = await prisma.adminPushSubscription.findMany({
    where: { storeId: event.storeId },
  });
  if (subscriptions.length === 0) {
    return { sent: 0, skipped: "no_subscriptions" as const };
  }

  let sent = 0;
  const eventKey = `${event.type}:${event.eventId}`;

  for (const sub of subscriptions) {
    const prefs = parseJson<StoredPrefs>(sub.prefsJson, {});
    if (!isEnabled(prefs, event.type)) continue;

    const sentEvents = parseJson<Record<string, number>>(
      sub.lastNotifiedJson,
      {}
    );
    if (sentEvents[eventKey]) continue;

    try {
      await sendWebPush(
        {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        {
          title: event.title,
          body: event.body,
          tag: event.tag ?? eventKey,
          url: event.url,
        }
      );
      sent += 1;
      sentEvents[eventKey] = Date.now();
      await prisma.adminPushSubscription.update({
        where: { id: sub.id },
        data: {
          lastNotifiedJson: JSON.stringify(pruneEventMap(sentEvents)),
        },
      });
    } catch (err) {
      const status =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;
      if (status === 404 || status === 410) {
        await prisma.adminPushSubscription
          .delete({ where: { id: sub.id } })
          .catch(() => null);
      }
    }
  }

  return { sent, skipped: null };
}

export async function notifyStockLevel(params: {
  storeId: string;
  productId: string;
  eventId: string;
}) {
  try {
    await notifyStockLevelUnsafe(params);
  } catch {
    // Notificação nunca deve impedir uma venda ou ajuste de estoque.
  }
}

async function notifyStockLevelUnsafe(params: {
  storeId: string;
  productId: string;
  eventId: string;
}) {
  const product = await prisma.product.findFirst({
    where: { id: params.productId, storeId: params.storeId },
    select: {
      name: true,
      quantity: true,
      reservedQuantity: true,
    },
  });
  if (!product) return;

  const available = availableStock(product);
  if (available > 5) return;
  const type: AdminNotificationId =
    available <= 0 ? "out_of_stock" : "low_stock";
  const title =
    type === "out_of_stock" ? "Produto esgotado" : "Estoque baixo";
  await dispatchAdminNotification({
    storeId: params.storeId,
    type,
    eventId: `${params.eventId}:${params.productId}:${available}`,
    title,
    body: `${product.name}: ${Math.max(0, available)} disponível(is).`,
    url: "/admin/produtos",
    tag: `stock-${type}-${params.productId}`,
  });
}
