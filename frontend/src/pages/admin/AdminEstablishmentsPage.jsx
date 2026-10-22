import { useCallback, useEffect, useState } from "react";
import Alert from "../../components/Alert.jsx";
import Spinner from "../../components/Spinner.jsx";
import { getErrorMessage } from "../../services/api.js";
import { createEstablishment, listMyEstablishments, updateEstablishment } from "../../services/establishments.js";
import { listUsers } from "../../services/users.js";
import { CATEGORY_LABELS } from "../../utils/constants.js";

const EMPTY_FORM = { name: "", category: "COMMERCE", address: "", city: "", phone: "", owner_id: "" };

export default function AdminEstablishmentsPage() {
  const [establishments, setEstablishments] = useState(null);
  const [merchants, setMerchants] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      // L'admin reçoit TOUS les établissements via /mine, y compris désactivés
      const [list, merchantList] = await Promise.all([listMyEstablishments(), listUsers({ role: "MERCHANT" })]);
      setEstablishments(list);
      setMerchants(merchantList);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action, successMessage) => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await action();
      setInfo(successMessage);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = (event) => {
    event.preventDefault();
    run(async () => {
      await createEstablishment({
        name: form.name.trim(),
        category: form.category,
        address: form.address.trim(),
        city: form.city.trim(),
        phone: form.phone.trim() || null,
        owner_id: form.owner_id ? Number(form.owner_id) : null,
      });
      setForm(EMPTY_FORM);
    }, "Établissement créé.");
  };

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const merchantOptions = (
    <>
      <option value="">— Aucun —</option>
      {merchants.map((m) => (
        <option key={m.id} value={m.id}>{m.full_name} ({m.email})</option>
      ))}
    </>
  );

  if (!establishments) return error ? <Alert type="error">{error}</Alert> : <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Établissements</h1>
      <Alert type="error">{error}</Alert>
      <Alert type="success">{info}</Alert>

      <form onSubmit={handleCreate} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="font-semibold sm:col-span-2 lg:col-span-3">Ajouter un établissement</h2>
        <div>
          <label className="label" htmlFor="est-name">Nom</label>
          <input id="est-name" name="name" required className="input" value={form.name} onChange={handleChange} />
        </div>
        <div>
          <label className="label" htmlFor="est-category">Catégorie</label>
          <select id="est-category" name="category" className="input" value={form.category} onChange={handleChange}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="est-owner">Commerçant</label>
          <select id="est-owner" name="owner_id" className="input" value={form.owner_id} onChange={handleChange}>
            {merchantOptions}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="est-address">Adresse</label>
          <input id="est-address" name="address" required className="input" value={form.address} onChange={handleChange} />
        </div>
        <div>
          <label className="label" htmlFor="est-city">Ville</label>
          <input id="est-city" name="city" required className="input" value={form.city} onChange={handleChange} />
        </div>
        <div>
          <label className="label" htmlFor="est-phone">Téléphone</label>
          <input id="est-phone" name="phone" className="input" value={form.phone} onChange={handleChange} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <button type="submit" disabled={busy} className="btn btn-primary">Créer</button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-slate-500">
            <tr><th className="py-2">Nom</th><th>Catégorie</th><th>Ville</th><th>Commerçant</th><th>État</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {establishments.map((est) => (
              <tr key={est.id}>
                <td className="py-2 font-medium">{est.name}</td>
                <td>{CATEGORY_LABELS[est.category]}</td>
                <td>{est.city}</td>
                <td>
                  <select className="input py-1" disabled={busy} value={est.owner_id ?? ""}
                    onChange={(e) => run(
                      () => updateEstablishment(est.id, { owner_id: e.target.value ? Number(e.target.value) : null }),
                      "Commerçant mis à jour."
                    )}>
                    {merchantOptions}
                  </select>
                </td>
                <td>
                  <button type="button" disabled={busy}
                    onClick={() => run(
                      () => updateEstablishment(est.id, { is_active: !est.is_active }),
                      est.is_active ? "Établissement désactivé." : "Établissement activé."
                    )}
                    className={`btn py-1 ${est.is_active ? "btn-secondary" : "btn-success"}`}>
                    {est.is_active ? "Désactiver" : "Activer"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}