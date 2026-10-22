import { useEffect, useState } from "react";

const PING_INTERVAL_MS = 25_000;   // garde la connexion vivante (proxys)
const MAX_RETRY_DELAY_MS = 30_000; // délai maximal entre deux tentatives

/**
 * Écoute les mises à jour temps réel d'une file.
 * @returns {{ message: object|null, status: string }}
 *   status : idle | connecting | open | reconnecting | unauthorized | not_found
 */
export default function useQueueSocket(queueId, token) {
  const [message, setMessage] = useState(null);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!queueId || !token) return undefined; // rien à écouter

    let socket = null;
    let pingTimer = null;
    let retryTimer = null;
    let attempts = 0;
    let stopped = false; // devient true quand le composant disparaît

    const connect = () => {
      setStatus(attempts === 0 ? "connecting" : "reconnecting");
      const url =
        `${import.meta.env.VITE_WS_URL}/ws/queues/${queueId}` +
        `?token=${encodeURIComponent(token)}`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        attempts = 0;
        setStatus("open");
        pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, PING_INTERVAL_MS);
      };

      socket.onmessage = (event) => {
        if (event.data === "pong") return; // réponse au ping : rien à faire
        try {
          setMessage(JSON.parse(event.data)); // snapshot, ticket_called, ...
        } catch {
          // message non JSON inattendu : ignoré
        }
      };

      socket.onclose = (event) => {
        clearInterval(pingTimer);
        if (stopped) return; // fermeture volontaire (changement de page)

        // Refus définitifs décidés par le serveur (étape 4) : pas de reconnexion
        if (event.code === 4401) return setStatus("unauthorized");
        if (event.code === 4404) return setStatus("not_found");

        // Coupure réseau, serveur redémarré... : nouvelle tentative plus tard
        attempts += 1;
        const delay = Math.min(1000 * 2 ** (attempts - 1), MAX_RETRY_DELAY_MS);
        setStatus("reconnecting");
        retryTimer = setTimeout(connect, delay);
      };
      // Pas de onerror : en cas d'erreur, le navigateur appelle toujours onclose ensuite.
    };

    connect();

    // Nettoyage : quand on quitte la page ou que queueId / token change
    return () => {
      stopped = true;
      clearInterval(pingTimer);
      clearTimeout(retryTimer);
      if (socket) socket.close(1000);
    };
  }, [queueId, token]);

  return { message, status };
}