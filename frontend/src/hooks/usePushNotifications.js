import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getErrorMessage } from "../services/api.js";
import { FCM_TOKEN_KEY, registerDeviceToken } from "../services/devices.js";
import { getMessagingIfSupported, obtainFcmToken } from "../services/firebase.js";

// Obtient le jeton et l'envoie au backend (idempotent)
async function syncToken() {
  const token = await obtainFcmToken();
  if (!token) return;
  await registerDeviceToken(token);
  localStorage.setItem(FCM_TOKEN_KEY, token);
}

/**
 * state : checking | unsupported | default | granted | denied
 * ("default" = l'utilisateur n'a encore rien décidé)
 */
export default function usePushNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState("checking");
  const [error, setError] = useState("");

  // 1) Ce navigateur sait-il recevoir des notifications ? Quelle est la décision actuelle ?
  useEffect(() => {
    let cancelled = false;
    getMessagingIfSupported().then((messaging) => {
      if (!cancelled) setState(messaging ? Notification.permission : "unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Déjà autorisé : on resynchronise le jeton (nouvelle connexion, jeton renouvelé...)
  useEffect(() => {
    if (state === "granted" && user) {
      syncToken().catch((err) => setError(getErrorMessage(err) || String(err)));
    }
  }, [state, user]);

  // 3) Appelé sur un clic : affiche la fenêtre d'autorisation du navigateur
  const enable = useCallback(async () => {
    setError("");
    try {
      const permission = await Notification.requestPermission();
      setState(permission); // l'effet 2 enverra le jeton si "granted"
    } catch (err) {
      setError(String(err));
    }
  }, []);

  return { state, enable, error };
}