import api from "./api.js";

// Retire les filtres vides pour ne pas envoyer ?search=&city=
function cleanParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value != null));
}

export async function listEstablishments(filters) {
  const { data } = await api.get("/api/establishments", { params: cleanParams(filters) });
  return data;
}

export async function getEstablishment(id) {
  const { data } = await api.get(`/api/establishments/${id}`);
  return data;
}

export async function listEstablishmentQueues(id) {
  const { data } = await api.get(`/api/establishments/${id}/queues`);
  return data;
}

export async function listMyEstablishments() {
  const { data } = await api.get("/api/establishments/mine");
  return data;
}

export async function createEstablishment(payload) {
  const { data } = await api.post("/api/establishments", payload);
  return data;
}

export async function updateEstablishment(id, payload) {
  const { data } = await api.patch(`/api/establishments/${id}`, payload);
  return data;
}

export async function createQueue(establishmentId, payload) {
  const { data } = await api.post(`/api/establishments/${establishmentId}/queues`, payload);
  return data;
}