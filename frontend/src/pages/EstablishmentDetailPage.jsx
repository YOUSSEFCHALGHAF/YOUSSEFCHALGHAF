import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getErrorMessage } from "../services/api.js";
import { getEstablishment, listEstablishmentQueues } from "../services/establishments.js";
import { takeTicket } from "../services/queues.js";
import { CATEGORY_LABELS } from "../utils/constants.js";

export default function EstablishmentDetailPage() {
  const { id } = useParams(); // "5" dans /establishments/5
  const { user } = useAuth();
  const navigate = useNavigate();
  const [establishment, setEstablishment] = useState(null);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyQueueId, setBusyQueueId] = useState(null);

  const load = useCallback(async () => {
    try {
      // Deux requêtes en parallèle
      const [est, queueList] = await Promise.all([getEstablishment(id), listEstablishmentQueues(id)]);
      setEstablishment(est);
      setQueues(queueList);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTake = async (queueId) => {
    if (!user) {
      navigate("/login", { state: { from: `/establishments/${id}` } });
      return;
    }
    setActionError("");
    setBusyQueueId(queueId);
    try {
      const ticket = await takeTicket(queueId);
      navigate(`/tickets/${ticket.id}`); // écran de suivi en temps réel
    } catch (err) {
      setActionError(getErrorMessage(err)); // ex. "Vous avez déjà un ticket actif..."
      setBusyQueueId(null);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <Alert type="error">{error}</Alert>;

  const isClientOrGuest = !user || user.role === "CLIENT";

  return (
    <div className="space-y-6">
      <Link to="/establishments" className="text-sm text-blue-700 underline">← Tous les établissements</Link>

      <div className="card">
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          {CATEGORY_LABELS[establishment.category]}
        </span>
        <h1 className="mt-1 text-2xl font-bold">{establishment.name}</h1>
        <p className="mt-1 text-slate-600">{establishment.address}, {establishment.city}</p>
        {establishment.phone && <p className="text-sm text-slate-500">Tél. {establishment.phone}</p>}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Files d’attente</h2>
        <button type="button" onClick={load} className="btn btn-secondary">Actualiser</button>
      </div>

      {actionError && (
        <Alert type="error">
          {actionError}{" "}
          {user?.role === "CLIENT" && <Link to="/my-tickets" className="underline">Voir mes tickets</Link>}
        </Alert>
      )}

      {queues.length === 0 && <p className="text-slate-500">Aucune file pour le moment.</p>}

      <ul className="grid gap-4 sm:grid-cols-2">
        {queues.map((queue) => {
          const available = queue.is_open && queue.remote_booking_enabled;
          return (
            <li key={queue.id} className="card flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{queue.name}</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  queue.is_open ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-600"}`}>
                  {queue.is_open ? "Ouverte" : "Fermée"}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-slate-500">En attente</dt>
                  <dd className="text-xl font-bold">{queue.waiting_count}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Attente estimée</dt>
                  <dd className="text-xl font-bold">≈ {queue.estimated_wait_minutes} min</dd>
                </div>
              </dl>

              {isClientOrGuest && (
                <button type="button" className="btn btn-primary mt-auto"
                  disabled={!available || busyQueueId !== null}
                  onClick={() => handleTake(queue.id)}>
                  {busyQueueId === queue.id ? "Réservation…"
                    : !queue.is_open ? "File fermée"
                    : !queue.remote_booking_enabled ? "Ticket à distance indisponible"
                    : "Prendre un ticket"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}