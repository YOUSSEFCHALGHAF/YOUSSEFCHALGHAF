import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { getErrorMessage } from "../services/api.js";
import { getMyTickets } from "../services/tickets.js";

const ACTIVE = ["WAITING", "CALLED"];

function formatDate(value) {
  return value ? new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "";
}

function TicketRow({ ticket }) {
  const active = ACTIVE.includes(ticket.status);
  return (
    <li className="card flex flex-wrap items-center gap-3">
      <span className="text-2xl font-bold text-blue-700">{ticket.code}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{ticket.establishment_name}</p>
        <p className="text-sm text-slate-500">{ticket.queue_name} · {formatDate(ticket.created_at)}</p>
      </div>
      <StatusBadge status={ticket.status} />
      {active && <Link to={`/tickets/${ticket.id}`} className="btn btn-primary">Suivre</Link>}
    </li>
  );
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyTickets()
      .then(setTickets)
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!tickets) return <Spinner />;

  const active = tickets.filter((t) => ACTIVE.includes(t.status));
  const history = tickets.filter((t) => !ACTIVE.includes(t.status));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Tickets en cours</h1>
        {active.length === 0 ? (
          <p className="text-slate-500">
            Aucun ticket en cours. <Link to="/establishments" className="text-blue-700 underline">Prendre un ticket</Link>
          </p>
        ) : (
          <ul className="space-y-3">{active.map((t) => <TicketRow key={t.id} ticket={t} />)}</ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Historique</h2>
        {history.length === 0 ? (
          <p className="text-slate-500">Aucun ticket terminé.</p>
        ) : (
          <ul className="space-y-3">{history.map((t) => <TicketRow key={t.id} ticket={t} />)}</ul>
        )}
      </section>
    </div>
  );
}