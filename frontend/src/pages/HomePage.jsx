import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { homePathFor } from "../utils/constants.js";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <section className="space-y-6 py-10 text-center sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">Ne faites plus la queue sur place</h1>
      <p className="mx-auto max-w-xl text-slate-600">
        Prenez un ticket virtuel, suivez votre position en temps réel et soyez prévenu avant
        votre tour.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/establishments" className="btn btn-primary">
          Trouver un établissement
        </Link>
        {user ? (
          <Link to={homePathFor(user.role)} className="btn btn-secondary">
            Mon espace
          </Link>
        ) : (
          <Link to="/register" className="btn btn-secondary">
            Créer un compte
          </Link>
        )}
      </div>
    </section>
  );
}