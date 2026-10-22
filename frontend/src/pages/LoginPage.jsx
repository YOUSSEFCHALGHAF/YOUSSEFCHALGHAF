import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Alert from "../components/Alert.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getErrorMessage } from "../services/api.js";
import { homePathFor } from "../utils/constants.js";

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Déjà connecté (ou connexion réussie) : redirection
  if (user) {
    return <Navigate to={location.state?.from ?? homePathFor(user.role)} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault(); // empêche le rechargement de la page
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password); // met "user" à jour => redirection ci-dessus
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={handleSubmit} className="card space-y-4">
        <h1 className="text-2xl font-bold">Connexion</h1>
        <Alert type="error">{error}</Alert>

        <div>
          <label htmlFor="email" className="label">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="password" className="label">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Connexion…" : "Se connecter"}
        </button>

        <p className="text-center text-sm text-slate-600">
          Pas encore de compte ?{" "}
          <Link to="/register" className="text-blue-700 underline">Inscrivez-vous</Link>
        </p>
      </form>

      {import.meta.env.DEV && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Démo : client@example.com, poste@example.com, admin@example.com — mot de passe Demo2026!
        </p>
      )}
    </div>
  );
}