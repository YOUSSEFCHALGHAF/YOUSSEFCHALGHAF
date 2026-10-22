import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Alert from "../components/Alert.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getErrorMessage } from "../services/api.js";
import { homePathFor } from "../utils/constants.js";

const EMPTY_FORM = { full_name: "", email: "", password: "", confirm: "" };

// Mêmes règles que le schéma UserCreate du backend (étape 3)
function validate(form) {
  if (form.full_name.trim().length < 2) return "Le nom doit contenir au moins 2 caractères.";
  if (form.password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
    return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  }
  if (form.password !== form.confirm) return "Les deux mots de passe ne correspondent pas.";
  return "";
}

export default function RegisterPage() {
  const { user, register } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  // Un seul gestionnaire pour tous les champs, grâce à l'attribut "name"
  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const message = validate(form);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
    } catch (err) {
      setError(getErrorMessage(err)); // ex. "Cet e-mail est déjà utilisé"
      setSubmitting(false);
    }
  };

  const fields = [
    { name: "full_name", label: "Nom complet", type: "text", autoComplete: "name" },
    { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
    { name: "password", label: "Mot de passe", type: "password", autoComplete: "new-password" },
    { name: "confirm", label: "Confirmer le mot de passe", type: "password", autoComplete: "new-password" },
  ];

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Créer un compte</h1>
      <Alert type="error">{error}</Alert>

      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="label">{field.label}</label>
          <input
            id={field.name}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            required
            className="input"
            value={form[field.name]}
            onChange={handleChange}
          />
        </div>
      ))}

      <p className="text-xs text-slate-500">8 caractères minimum, dont au moins une lettre et un chiffre.</p>

      <button type="submit" disabled={submitting} className="btn btn-primary w-full">
        {submitting ? "Création…" : "Créer mon compte"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Déjà inscrit ? <Link to="/login" className="text-blue-700 underline">Connectez-vous</Link>
      </p>
    </form>
  );
}