import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold text-slate-900">404</h1>
      <p className="text-slate-600">Cette page n’existe pas.</p>
      <Link to="/" className="text-blue-600 underline">
        Retour à l’accueil
      </Link>
    </main>
  );
}