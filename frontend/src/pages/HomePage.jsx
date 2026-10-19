import { useEffect, useState } from "react";
import api, { getErrorMessage } from "../services/api.js";

export default function HomePage() {
  const [health, setHealth] = useState(null);   // réponse de l'API
  const [error, setError] = useState("");       // message d'erreur
  const [loading, setLoading] = useState(true); // chargement en cours

  useEffect(() => {
    // Exécuté une seule fois, quand la page s'affiche
    api
      .get("/api/health")
      .then((response) => setHealth(response.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">SmartQueue</h1>
        <p className="text-slate-600">
          Prenez votre ticket à distance et suivez votre tour en temps réel.
        </p>

        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium text-slate-500 mb-1">État de l’API</p>
          {loading && <p className="text-slate-500">Vérification…</p>}
          {!loading && health && (
            <p className="text-green-700 font-semibold">
              ✔ API connectée — base de données : {health.database}
            </p>
          )}
          {!loading && error && (
            <p className="text-red-700 font-semibold">✖ {error}</p>
          )}
        </div>
      </div>
    </main>
  );
}