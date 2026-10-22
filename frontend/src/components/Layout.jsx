import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ROLE_LABELS } from "../utils/constants.js";

function linksFor(user) {
  if (!user) return [{ to: "/establishments", label: "Établissements" }];
  if (user.role === "ADMIN") {
    return [
      { to: "/admin/establishments", label: "Établissements" },
      { to: "/admin/users", label: "Utilisateurs" },
      { to: "/merchant", label: "Files" },
    ];
  }
  if (user.role === "MERCHANT") return [{ to: "/merchant", label: "Tableau de bord" }];
  return [
    { to: "/establishments", label: "Établissements" },
    { to: "/my-tickets", label: "Mes tickets" },
  ];
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="text-lg font-bold text-blue-700">
            SmartQueue
          </Link>

          <nav className="flex flex-wrap gap-4 text-sm">
            {linksFor(user).map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  isActive ? "font-semibold text-blue-700" : "text-slate-600 hover:text-slate-900"
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="hidden text-slate-500 sm:inline">
                  {user.full_name} · {ROLE_LABELS[user.role]}
                </span>
                <button type="button" onClick={handleLogout} className="btn btn-secondary">
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-slate-600 hover:text-slate-900">
                  Connexion
                </Link>
                <Link to="/register" className="btn btn-primary">
                  Inscription
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}