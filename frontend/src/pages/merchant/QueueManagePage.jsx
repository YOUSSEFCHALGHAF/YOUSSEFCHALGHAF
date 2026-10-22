import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alert from "../../components/Alert.jsx";
import LiveIndicator from "../../components/LiveIndicator.jsx";
import Spinner from "../../components/Spinner.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import useQueueSocket from "../../hooks/useQueueSocket.js";
import { getErrorMessage } from "../../services/api.js";
import { callNext, getQueue, getQueueStats, listQueueTickets, updateQueue } from "../../services/queues.js";
import { changeTicketStatus } from "../../services/tickets.js";
import { STATUS_LABELS } from "../../utils/constants.js";

function formatTime(value) {
  return new Date(value).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value ?? "—"}</p>
    </div>
  );
}

export default function QueueManagePage() {
  const { id } = useParams();
  const queueId = Number(id);
  const { token } = useAuth();
  const [queue, setQueue] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [q, t, s] = await Promise.all([getQueue(queueId), listQueueTickets(queueId), getQueueStats(queueId)]);
      setQueue(q);
      setTickets(t);
      setStats(s);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [queueId]);

  useEffect(() => {
    load();
  }, [load]);

  // Temps réel : à chaque message (nouveau ticket, annulation...), on recharge la vue
  const { message, status: liveStatus } = useQueueSocket(queueId, token);
  useEffect(() => {
    if (message) load();
  }, [message, load]);

  // Exécute une action, affiche son résultat, puis recharge
  const run = async (action) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const resultMessage = await action();
      if (resultMessage) setInfo(resultMessage);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCallNext = () => run(async () => `Ticket ${(await callNext(queueId)).code} appelé.`);

  const handleStatus = (ticket, status) =>
    run(async () => {
      await changeTicketStatus(ticket.id, status);
      return `${ticket.code} : ${STATUS_LABELS[status].toLowerCase()}.`;
    });

  const handleToggle = (field) =>
    run(async () => {
      await updateQueue(queueId, { [field]: !queue[field] });
      return "";
    });

  if (!queue) return error ? <Alert type="error">{error}</Alert> : <Spinner />;

  const called = tickets.find((t) => t.status === "CALLED");
  const waiting = tickets.filter((t) => t.status === "WAITING");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/merchant" className="text-sm text-blue-700 underline">← Tableau de bord</Link>
        <h1 className="text-2xl font-bold">{queue.name}</h1>
        <LiveIndicator status={liveStatus} />
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{info}</Alert>

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => handleToggle("is_open")}
          className={`btn ${queue.is_open ? "btn-secondary" : "btn-success"}`}>
          {queue.is_open ? "Fermer la file" : "Ouvrir la file"}
        </button>
        <button type="button" disabled={busy} onClick={() => handleToggle("remote_booking_enabled")}
          className="btn btn-secondary">
          {queue.remote_booking_enabled ? "Désactiver les tickets à distance" : "Activer les tickets à distance"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Guichet */}
        <section className="card space-y-4 text-center lg:col-span-1">
          <p className="text-sm text-slate-500">Client appelé</p>
          <p className="text-5xl font-extrabold text-green-700">{called ? called.code : "—"}</p>
          {called && (
            <div className="flex justify-center gap-2">
              <button type="button" disabled={busy} onClick={() => handleStatus(called, "SERVED")}
                className="btn btn-success">Servi</button>
              <button type="button" disabled={busy} onClick={() => handleStatus(called, "NO_SHOW")}
                className="btn btn-secondary">Absent</button>
            </div>
          )}
          <button type="button" disabled={busy || waiting.length === 0} onClick={handleCallNext}
            className="btn btn-primary w-full py-4 text-lg">
            Appeler le suivant ({waiting.length} en attente)
          </button>
        </section>

        {/* Liste d'attente */}
        <section className="card space-y-3 lg:col-span-2">
          <h2 className="font-semibold">File d’attente</h2>
          {waiting.length === 0 ? (
            <p className="text-sm text-slate-500">Personne en attente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr><th className="py-2">Ticket</th><th>Position</th><th>Pris à</th><th className="text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waiting.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="py-2 font-semibold">{ticket.code}</td>
                      <td>{ticket.position}</td>
                      <td>{formatTime(ticket.created_at)}</td>
                      <td className="space-x-2 text-right">
                        <button type="button" disabled={busy} onClick={() => handleStatus(ticket, "NO_SHOW")}
                          className="text-amber-700 underline">Absent</button>
                        <button type="button" disabled={busy} onClick={() => handleStatus(ticket, "CANCELLED")}
                          className="text-red-700 underline">Retirer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Statistiques du jour (BF-14) */}
      {stats && (
        <section className="card space-y-3">
          <h2 className="font-semibold">Aujourd’hui</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Tickets" value={stats.total} />
            <StatCard label="Servis" value={stats.served} />
            <StatCard label="Absents" value={stats.no_show} />
            <StatCard label="Annulés" value={stats.cancelled} />
            <StatCard label="Attente moy. (min)" value={stats.avg_wait_minutes} />
            <StatCard label="Service moy. (min)" value={stats.avg_service_minutes} />
          </div>
        </section>
      )}
    </div>
  );
}