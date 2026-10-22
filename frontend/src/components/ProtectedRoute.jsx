import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homePathFor } from "../utils/constants.js";
import Spinner from "./Spinner.jsx";

// roles : liste des rôles autorisés ; absent = tout utilisateur connecté
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Vérification de la session…" />;

  if (!user) {
    // On mémorise la page demandée pour y revenir après connexion
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  return <Outlet />; // affiche la page enfant
}