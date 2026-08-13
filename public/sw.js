const CACHE = "catalogo-v3-static";

const STATIC_ASSETS = [
  "/manifest.json",
  "/pdv-manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isStatic =
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/pdv-manifest.json";

  if (!isStatic) return;

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((c) => c.put(event.request, clone));
          }
          return response;
        })
    )
  );
});

function showFromPayload(data) {
  const title = data.title || "SaboArt";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "saboart-admin",
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || "/admin/pedidos?status=receivable",
    },
  };
  return self.registration.showNotification(title, options);
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "SHOW_NOTIFICATION") return;
  event.waitUntil(showFromPayload(data));
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "SaboArt",
    body: "Há um alerta pendente no admin.",
    tag: "saboart-push",
    url: "/admin/pedidos?status=receivable",
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    try {
      const text = event.data?.text();
      if (text) payload.body = text;
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(showFromPayload(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    "/admin/pedidos?status=receivable";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/admin") && "focus" in client) {
            return client.focus().then(() => {
              if ("navigate" in client) {
                return client.navigate(targetUrl);
              }
            });
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
