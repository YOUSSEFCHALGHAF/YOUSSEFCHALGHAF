import { useState } from "react";
import usePushNotifications from "../hooks/usePushNotifications.js";
import { getErrorMessage } from "../services/api.js";
import { sendTestNotification } from "../services/devices.js";
import Alert from "./Alert.jsx";

export default function NotificationPrompt() {
  const { state, enable, error } = usePushNotifications();
  const [testMessage, setTestMessage] = useState("");

  const handleTest = async () => {
    try {
      await sendTestNotification();
      setTestMessage("Notification de test envoyée.");
    } catch (err) {
      setTestMessage(getErrorMessage(err));
    }
  };

  if (state === "checking") return null;

  if (state === "granted") {
    return (
      <div className="text-xs text-green-700">
        🔔 Notifications activées sur cet appareil.
        {import.meta.env.DEV && (
          <button type="button" onClick={handleTest} className="ml-2 underline">Tester</button>
        )}
        {testMessage && <span className="ml-2 text-slate-600">{testMessage}</span>}
        {error && <span className="ml-2 text-red-700">{error}</span>}
      </div>
    );
  }

  if (state === "denied") {
    return (
      <Alert type="warning">
        Notifications bloquées. Pour les réactiver : cliquez sur l’icône à gauche de l’adresse →
        Notifications → Autoriser, puis rechargez la page.
      </Alert>
    );
  }

  if (state === "unsupported") {
    return (
      <Alert type="info">
        Ce navigateur ne peut pas recevoir de notifications. Sur iPhone ou iPad : bouton Partager →
        « Sur l’écran d’accueil », puis ouvrez SmartQueue depuis l’icône. En attendant, gardez cette
        page ouverte : elle se met à jour en direct.
      </Alert>
    );
  }

  // state === "default" : on propose
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-left text-sm">
      <p className="font-medium text-blue-900">Soyez prévenu même si vous fermez cette page.</p>
      <p className="text-blue-800">Nous vous alerterons quand votre tour approche et quand c’est à vous.</p>
      <button type="button" onClick={enable} className="btn btn-primary mt-3">Activer les notifications</button>
      {error && <p className="mt-2 text-red-700">{error}</p>}
    </div>
  );
}