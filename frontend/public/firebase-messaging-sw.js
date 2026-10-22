/* Service worker Firebase Cloud Messaging.
   S'exécute en arrière-plan, même quand aucun onglet SmartQueue n'est ouvert. */

// ⚠️ Même version que celle affichée par `npm ls firebase`
const FIREBASE_VERSION = "12.4.0";

importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`);
importScripts(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js`);

// La configuration arrive dans l'URL d'enregistrement (?apiKey=...&projectId=...)
const params = new URL(self.location.href).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

// Message reçu alors que l'onglet est fermé ou en arrière-plan
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  return self.registration.showNotification(data.title || "SmartQueue", {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag,          // une nouvelle notification du même ticket remplace l'ancienne
    renotify: Boolean(data.tag),
    data: { link: data.link || "/" },
  });
});

// Clic sur la notification : réutiliser un onglet déjà ouvert, sinon en ouvrir un
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.link || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })()
  );
});