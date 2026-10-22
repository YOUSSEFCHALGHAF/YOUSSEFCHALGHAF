import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alert from "../components/Alert.jsx";
import LiveIndicator from "../components/LiveIndicator.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import useQueueSocket from "../hooks/useQueueSocket.js";
import { getErrorMessage } from "../services/api.js";
import { cancelTicket, getTicket } from "../services/tickets.js";
import { APPROACHING_POSITION, STATUS_LABELS } from "../utils/constants.js";

export default function TicketPage() {
  const { id } = useParams();
  const { user, token, logout } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const lastHandled = useRef(null); // dernier message WebSocket déjà traité

  const loadTicket = useCallback(async () => {
    try {
      setTicket(await getTicket(id));
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  // On n'écoute la file que tant que le ticket est actif
  const isActive = ticket?.status === "WAITING" || ticket?.status === "CALLED";
  const { message, status: liveStatus } = useQueueSocket(isActive ? ticket.queue_id : null, token);

  // Un message me concerne-t-il ? Si oui, on recharge le ticket depuis l'API
  useEffect(() => {
    if (!message || !ticket || lastHandled.current === message) return;
    lastHandled.current = message;
    const queue = message.queue;
    const concernsMe =
      message.ticket?.id === ticket.id ||                                              // événement sur mon ticket
      (ticket.status === "CALLED" && queue.current_code !== ticket.code) ||            // je ne suis plus l'appelé
      (ticket.status === "WAITING" && !queue.waiting_numbers.includes(ticket.number)); // je ne suis plus en attente
    if (concernsMe) loadTicket();
  }, [message, ticket, loadTicket]);

  // Jeton refusé par le WebSocket : retour à la connexion
  useEffect(() => {
    if (liveStatus === "unauthorized") logout();
  }, [liveStatus, logout]);

  // Mon tour : titre de l'onglet + vibration (téléphones compatibles)
  useEffect(() => {
    if (ticket?.status !== "CALLED") return undefined;
    const previousTitle = document.title;
    document.title = `🔔 ${ticket.code} — C’est votre tour !`;
    navigator.vibrate?.([300, 100, 300]);
    return () => {
      document.title = previousTitle;
    };
  }, [ticket?.status, ticket?.code]);

  const handleCancel = async () => {
    if (!window.confirm("Voulez-vous vraiment annuler ce ticket ?")) return;
    setCancelling(true);
    try {
      setTicket(await cancelTicket(ticket.id));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  if (!ticket) return error ? <Alert type="error">{error}</Alert> : <Spinner />;

  // Position et attente : valeurs REST, remplacées par le calcul temps réel si disponible
  const queueState = message?.queue ?? null;
  let position = ticket.position;
  let estimated = ticket.estimated_wait_minutes;
  if (queueState && ticket.status === "WAITING") {
    const index = queueState.waiting_numbers.indexOf(ticket.number);
    if (index !== -1) {
      position = index + 1;
      estimated = Math.round(position * queueState.avg_service_minutes);
    }
  }
  const approaching = ticket.status === "WAITING" && position != null && position <= APPROACHING_POSITION;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Alert type="error">{error}</Alert>

      <div className="card space-y-5 text-center">
        <div className="flex items-center justify-between text-left">
          <div>
            <p className="font-semibold">{ticket.establishment_name}</p>
            <p className="text-sm text-slate-500">{ticket.queue_name}</p>
          </div>
          {isActive && <LiveIndicator status={liveStatus} />}
        </div>

        <div>
          <p className="text-sm text-slate-500">Votre ticket</p>
          <p className="text-6xl font-extrabold tracking-wider text-blue-700">{ticket.code}</p>
          <div className="mt-2"><StatusBadge status={ticket.status} /></div>
        </div>

        {ticket.status === "CALLED" && (
          <div className="rounded-xl bg-green-600 p-4 text-white">
            <p className="text-xl font-bold">C’est votre tour !</p>
            <p className="text-sm">Présentez-vous au guichet avec le code {ticket.code}.</p>
          </div>
        )}

        {ticket.status === "WAITING" && (
          <dl className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">Position</dt>
              <dd className="text-4xl font-bold">{position ?? "—"}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">Attente estimée</dt>
              <dd className="text-4xl font-bold">≈ {estimated ?? "—"}<span className="text-base"> min</span></dd>
            </div>
          </dl>
        )}

        {approaching && <Alert type="warning">Votre tour approche : rapprochez-vous de l’établissement.</Alert>}

        {queueState && !queueState.is_open && ticket.status === "WAITING" && (
          <Alert type="warning">La file est momentanément fermée par l’établissement.</Alert>
        )}

        {queueState?.current_code && ticket.status === "WAITING" && (
          <p className="text-sm text-slate-600">Actuellement appelé : <strong>{queueState.current_code}</strong></p>
        )}

        {!isActive && (
          <Alert type="info">Ce ticket est terminé ({STATUS_LABELS[ticket.status].toLowerCase()}).</Alert>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {user?.role === "CLIENT" && ticket.status === "WAITING" && (
            <button type="button" onClick={handleCancel} disabled={cancelling} className="btn btn-danger">
              {cancelling ? "Annulation…" : "Annuler mon ticket"}
            </button>
          )}
          {user?.role === "CLIENT" && <Link to="/my-tickets" className="btn btn-secondary">Mes tickets</Link>}
        </div>
      </div>

      {isActive && (
        <p className="text-center text-xs text-slate-500">
          Gardez cette page ouverte : elle se met à jour automatiquement.
        </p>
      )}
    </div>
  );
}