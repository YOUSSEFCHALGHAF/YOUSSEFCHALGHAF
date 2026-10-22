import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../../components/Alert.jsx";
import Spinner from "../../components/Spinner.jsx";
import { getErrorMessage } from "../../services/api.js";
import { createQueue, listEstablishmentQueues, listMyEstablishments } from "../../services/establishments.js";

const EMPTY_QUEUE = { name: "", prefix: "A", avg_service_minutes: 5 };

function NewQueueForm({ establishmentId, onCreated }) {
  const [form, setForm] = useState(EMPTY_QUEUE);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createQueue(establishmentId, {
        name: form.name.trim(),
        prefix: form.prefix.trim().toUpperCase(),
        avg_service_minutes: Number(form.avg_service_minutes), // les champs HTML sont des textes
      });
      setForm(EMPTY_QUEUE);
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-slate-50 p-4">
      <p className="text-sm font-semibold">Nouvelle file</p>
      <Alert type="error">{error}</Alert>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor={`name-${establishmentId}`}>Nom</label>
          <input id={`name-${establishmentId}`} name="name" required className="input"
            value={form.name} onChange={handleChange} />
        </div>
        <div>
          <label className="label" htmlFor={`prefix-${establishmentId}`}>Préfixe</label>
          <input id={`prefix-${establishmentId}`} name="prefix" required maxLength={3} className="input uppercase"
            value={form.prefix} onChange={handleChange} />
        </div>
        <div>
          <label className="label" htmlFor={`avg-${establishmentId}`}>Durée (min)</label>
          <input id={`avg-${establishmentId}`} name="avg_service_minutes" type="number" min={1} max={240}
            required className="input" value={form.avg_service_minutes} onChange={handleChange} />
        </div>
        <button type="submit" disabled={saving} className="btn btn-primary">Créer</button>
      </div>
    </form>
  );
}

export default function MerchantDashboardPage() {
  const [items, setItems] = useState(null); // [{ establishment, queues }]
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const establishments = await listMyEstablishments();
      const withQueues = await Promise.all(
        establishments.map(async (establishment) => ({
          establishment,
          queues: await listEstablishmentQueues(establishment.id),
        }))
      );
      setItems(withQueues);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!items) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

      {items.length === 0 && (
        <Alert type="info">Aucun établissement ne vous est attribué. Contactez l’administrateur.</Alert>
      )}

      {items.map(({ establishment, queues }) => (
        <section key={establishment.id} className="card space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{establishment.name}</h2>
            {!establishment.is_active && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">Désactivé</span>
            )}
          </div>

          <ul className="divide-y divide-slate-100">
            {queues.map((queue) => (
              <li key={queue.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="w-10 text-center text-lg font-bold text-blue-700">{queue.prefix}</span>
                <div className="flex-1">
                  <p className="font-medium">{queue.name}</p>
                  <p className="text-sm text-slate-500">
                    {queue.is_open ? "Ouverte" : "Fermée"} · {queue.waiting_count} en attente
                  </p>
                </div>
                <Link to={`/merchant/queues/${queue.id}`} className="btn btn-primary">Gérer</Link>
              </li>
            ))}
          </ul>

          <NewQueueForm establishmentId={establishment.id} onCreated={load} />
        </section>
      ))}
    </div>
  );
}