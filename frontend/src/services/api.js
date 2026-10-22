import axios from "axios";

export const TOKEN_KEY = "smartqueue_token"; // clé dans le localStorage

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
});

// 1) Avant chaque requête : ajouter le jeton s'il existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 2) Après chaque réponse en erreur : jeton refusé => déconnexion globale
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      // Événement écouté par AuthContext (section 4)
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error); // la page reçoit quand même l'erreur
  }
);

// Transforme n'importe quelle erreur Axios en phrase lisible
export function getErrorMessage(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail; // erreurs métier FastAPI
  if (Array.isArray(detail) && detail.length > 0) {
    // erreurs de validation 422 : liste d'objets {loc, msg, ...}
    return detail.map((item) => item.msg.replace(/^Value error, /, "")).join(" · ");
  }
  if (error?.response) return `Erreur ${error.response.status}`;
  if (error?.request) return "Le serveur ne répond pas";
  return "Erreur inattendue";
}

export default api;