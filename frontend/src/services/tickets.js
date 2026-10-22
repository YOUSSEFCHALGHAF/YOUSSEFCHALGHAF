import api from "./api.js";

export async function getMyTickets() {
  const { data } = await api.get("/api/tickets/me");
  return data;
}

export async function getTicket(id) {
  const { data } = await api.get(`/api/tickets/${id}`);
  return data;
}

export async function cancelTicket(id) {
  const { data } = await api.post(`/api/tickets/${id}/cancel`);
  return data;
}

export async function changeTicketStatus(id, status) {
  const { data } = await api.patch(`/api/tickets/${id}/status`, { status });
  return data;
}