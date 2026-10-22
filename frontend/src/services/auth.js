import api from "./api.js";

export async function loginRequest(email, password) {
  // OAuth2 attend un formulaire : "username" contient l'e-mail
  const body = new URLSearchParams({ username: email, password });
  const { data } = await api.post("/api/auth/login", body);
  return data.access_token;
}

export async function registerRequest(payload) {
  const { data } = await api.post("/api/auth/register", payload);
  return data;
}

export async function fetchMe() {
  const { data } = await api.get("/api/auth/me");
  return data;
}