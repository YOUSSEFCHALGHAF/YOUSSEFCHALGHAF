import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";
import { getErrorMessage } from "../services/api.js";
import { listEstablishments } from "../services/establishments.js";
import { CATEGORY_LABELS } from "../utils/constants.js";

export default function EstablishmentsPage() {
  const [filters, setFilters] = useState({ search: "", category: "", city: "" });
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false; // ignore les réponses d'anciennes recherches
    const timer = setTimeout(() => {
      setLoading(true);
      listEstablishments(filters)
        .then((data) => {
          if (cancelled) return;
          setEstablishments(data);
          setError("");
        })
        .catch((err) => !cancelled && setError(getErrorMessage(err)))
        .finally(() => !cancelled && setLoading(false));
    }, 300); // "debounce" : on attend que l'utilisateur arrête de taper

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters]);

  const handleChange = (event) => {
    setFilters({ ...filters, [event.target.name]: event.target.value });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Établissements</h1>

      <div className="card grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="search" className="label">Nom</label>
          <input id="search" name="search" className="input" placeholder="ex. poste"
            value={filters.search} onChange={handleChange} />
        </div>
        <div>
          <label htmlFor="category" className="label">Catégorie</label>
          <select id="category" name="category" className="input"
            value={filters.category} onChange={handleChange}>
            <option value="">Toutes</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="city" className="label">Ville</label>
          <input id="city" name="city" className="input"
            value={filters.city} onChange={handleChange} />
        </div>
      </div>

      <Alert type="error">{error}</Alert>

      {loading ? (
        <Spinner />
      ) : establishments.length === 0 ? (
        <p className="py-10 text-center text-slate-500">Aucun établissement ne correspond à votre recherche.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {establishments.map((est) => (
            <li key={est.id}>
              <Link to={`/establishments/${est.id}`}
                className="card block h-full transition hover:border-blue-300 hover:shadow-md">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  {CATEGORY_LABELS[est.category]}
                </span>
                <h2 className="mt-1 text-lg font-semibold">{est.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{est.address}, {est.city}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}