import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TOKEN_KEY } from "../services/api.js";
import { fetchMe, loginRequest, registerRequest } from "../services/auth.js";
import { FCM_TOKEN_KEY, unregisterDeviceToken } from "../services/devices.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  const logout = useCallback(() => {
    const jwt = localStorage.getItem(TOKEN_KEY);
    const fcmToken = localStorage.getItem(FCM_TOKEN_KEY);
    if (jwt && fcmToken) {
      // Au mieux : si la requête échoue, le jeton sera réattribué au prochain compte connecté
      unregisterDeviceToken(fcmToken, jwt).catch(() => {});
    }
    localStorage.removeItem(FCM_TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // Au démarrage : jeton déjà stocké => on recharge le profil
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    fetchMe()
      .then(setUser)
      .catch(logout) // jeton expiré ou invalide
      .finally(() => setLoading(false));
  }, [logout]);

  // Déconnexion demandée par l'intercepteur Axios (réponse 401)
  useEffect(() => {
    window.addEventListener("auth:logout", logout);
    return () => window.removeEventListener("auth:logout", logout);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const newToken = await loginRequest(email, password);
    localStorage.setItem(TOKEN_KEY, newToken); // avant fetchMe : l'intercepteur le lit
    const me = await fetchMe();
    setToken(newToken);
    setUser(me);
    return me;
  }, []);

  const register = useCallback(
    async ({ email, password, full_name }) => {
      await registerRequest({ email, password, full_name });
      return login(email, password); // connexion automatique après inscription
    },
    [login]
  );

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé à l'intérieur de <AuthProvider>");
  }
  return context;
}