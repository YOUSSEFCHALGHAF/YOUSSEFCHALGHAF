import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messagingPromise = null; // initialisation unique, partagée par toute l'application

/** Retourne l'instance Messaging, ou null si ce navigateur / cette config ne le permet pas. */
export function getMessagingIfSupported() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (!firebaseConfig.apiKey || !VAPID_KEY) return null; // .env incomplet
      if (!("serviceWorker" in navigator) || !("Notification" in window)) return null;
      if (!(await isSupported())) return null; // ex. Safari iOS hors écran d'accueil
      return getMessaging(initializeApp(firebaseConfig));
    })();
  }
  return messagingPromise;
}

async function registerServiceWorker() {
  // La configuration est transmise au service worker par l'URL (section 6.4)
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`);
  await navigator.serviceWorker.ready; // attend qu'il soit actif
  return registration;
}

/** Obtient le jeton FCM de ce navigateur (l'autorisation doit déjà être accordée). */
export async function obtainFcmToken() {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return null;
  const serviceWorkerRegistration = await registerServiceWorker();
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration });
}

/** Messages reçus quand l'onglet est au premier plan. Retourne la fonction de désabonnement. */
export async function listenForegroundMessages(callback) {
  const messaging = await getMessagingIfSupported();
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}