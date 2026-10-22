import api from "./api.js";

export async function listUsers(params = {}) {
  const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  const { data } = await api.get("/api/users", { params: cleaned });
  return data;
}

export async function updateUser(id, payload) {
  const { data } = await api.patch(`/api/users/${id}`, payload);
  return data;
}