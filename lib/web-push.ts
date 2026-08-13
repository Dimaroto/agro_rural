import webpush from "web-push";

export function vapidConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim()
  );
}

export function getVapidPublicKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function configureWebPush() {
  const publicKey = getVapidPublicKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys não configuradas");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || "mailto:contateiedem@gmail.com",
    publicKey,
    privateKey
  );
  return webpush;
}

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

export async function sendWebPush(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: PushPayload
) {
  const push = configureWebPush();
  await push.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    JSON.stringify(payload),
    { TTL: 60 * 60 }
  );
}
