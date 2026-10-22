import api from "./api.js";

export const FCM_TOKEN_KEY = "smartqueue_fcm_token";

export async function registerDeviceToken(token) {
  await api.post("/api/devices", { token, user_agent: navigator.userAgent.slice(0, 255) });
}

// Le JWT est passé explicitement : à la déconnexion, il est retiré du localStorage
// avant que l'intercepteur Axios ne s'exécute.
export async function unregisterDeviceToken(token, jwt) {
  await api.post("/api/devices/unregister", { token }, { headers: { Authorization: `Bearer ${jwt}` } });
}

export async function sendTestNotification() {
  const { data } = await api.post("/api/devices/test");
  return data;
}