import { useCallback, useEffect, useState } from "react";
import Alert from "../../components/Alert.jsx";
import Spinner from "../../components/Spinner.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { getErrorMessage } from "../../services/api.js";
import { listUsers, updateUser } from "../../services/users.js";
import { ROLE_LABELS } from "../../utils/constants.js";

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [filters, setFilters] = useState({ search: "", role: "" });
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers(filters));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(load, 300); // même "debounce" que la recherche d'établissements
    return () => clearTimeout(timer);
  }, [load]);

  const handleUpdate = async (target, payload, successMessage) => {
    setBusyId(target.id);
    setError("");
    setInfo("");
    try {
      await updateUser(target.id, payload);
      setInfo(successMessage);
      await load();
    } catch (err) {
      setError(getErrorMessage(err)); // ex. "Vous ne pouvez pas retirer vos propres droits"
    } finally {
      setBusyId(null);
    }
  };

  const handleFilter = (event) => setFilters({ ...filters, [event.target.name]: event.target.value });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Utilisateurs</h1>

      <div className="card grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="user-search">Nom ou e-mail</label>
          <input id="user-search" name="search" className="input" value={filters.search} onChange={handleFilter} />
        </div>
        <div>
          <label className="label" htmlFor="user-role">Rôle</label>
          <select id="user-role" name="role" className="input" value={filters.role} onChange={handleFilter}>
            <option value="">Tous</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{info}</Alert>

      {!users ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-slate-500">
              <tr><th className="py-2">Nom</th><th>E-mail</th><th>Rôle</th><th>État</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isMe = u.id === currentUser.id;
                const disabled = isMe || busyId === u.id;
                return (
                  <tr key={u.id}>
                    <td className="py-2 font-medium">{u.full_name}{isMe && " (vous)"}</td>
                    <td>{u.email}</td>
                    <td>
                      <select className="input py-1" disabled={disabled} value={u.role}
                        onChange={(e) => handleUpdate(u, { role: e.target.value }, "Rôle modifié.")}>
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button type="button" disabled={disabled}
                        onClick={() => handleUpdate(u, { is_active: !u.is_active },
                          u.is_active ? "Compte désactivé." : "Compte activé.")}
                        className={`btn py-1 ${u.is_active ? "btn-secondary" : "btn-success"}`}>
                        {u.is_active ? "Désactiver" : "Activer"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}