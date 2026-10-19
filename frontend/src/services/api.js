import axios from "axios";

// Instance unique d'Axios utilisée par toute l'application
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000, // 10 secondes maximum par requête
  headers: { "Content-Type": "application/json" },
});

// Étape 5 : un intercepteur ajoutera ici le jeton JWT
// (Authorization: Bearer ...) à chaque requête.

export function getErrorMessage(error) {
  // Message lisible, quel que soit le type d'erreur
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail;
    return typeof detail === "string" ? detail : "Données invalides";
  }
  if (error.request) return "Le serveur ne répond pas";
  return "Erreur inattendue";
}

export default api;